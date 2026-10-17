// This wrapper observes only coarse failure stages; the vendored authority remains unchanged.
import * as oidc from 'openid-client';
import { randomBytes } from 'node:crypto';
import { googleAuthResponse } from './vendor/google-auth.mjs';

const TEMPORARILY_UNAVAILABLE = 'Sign-in is temporarily unavailable.';
const ROLE_LOOKUP = 'SELECT role,disabled FROM review_roles WHERE user_id=?';

function instrumentLibrary(library, mark, discoveryStage) {
  return new Proxy(library, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (property === 'discovery' && typeof value === 'function') {
        return async (...args) => {
          mark(discoveryStage);
          const result = await value.apply(target, args);
          mark(discoveryStage === 'login_discovery' ? 'login_flow' : 'callback_flow');
          return result;
        };
      }
      if (property === 'authorizationCodeGrant' && typeof value === 'function') {
        return async (...args) => {
          mark('callback_tokens');
          const result = await value.apply(target, args);
          mark('callback_claims');
          return result;
        };
      }
      return value;
    },
  });
}

function instrumentDb(db, mark) {
  if (!db || typeof db.prepare !== 'function') return db;
  return new Proxy(db, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (property !== 'prepare' || typeof value !== 'function') return value;
      return (sql, ...args) => {
        const roleLookup = sql === ROLE_LOOKUP;
        if (roleLookup) mark('callback_role_store');
        const statement = value.call(target, sql, ...args);
        if (!statement || typeof statement.bind !== 'function') return statement;
        return new Proxy(statement, {
          get(statementTarget, statementProperty) {
            const statementValue = Reflect.get(statementTarget, statementProperty, statementTarget);
            if (statementProperty !== 'bind' || typeof statementValue !== 'function') return statementValue;
            return (...bindArgs) => {
              const bound = statementValue.apply(statementTarget, bindArgs);
              if (!roleLookup || !bound || typeof bound.first !== 'function') return bound;
              return new Proxy(bound, {
                get(boundTarget, boundProperty) {
                  const boundValue = Reflect.get(boundTarget, boundProperty, boundTarget);
                  if (boundProperty !== 'first' || typeof boundValue !== 'function') return boundValue;
                  return async (...firstArgs) => {
                    const row = await boundValue.apply(boundTarget, firstArgs);
                    mark('callback_session_issue');
                    return row;
                  };
                },
              });
            };
          },
        });
      };
    },
  });
}

function copiedHeaders(response) {
  const headers = new Headers(response.headers);
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    if (cookies.length) {
      headers.delete('set-cookie');
      for (const cookie of cookies) headers.append('Set-Cookie', cookie);
    }
  }
  return headers;
}

/**
 * Delegate unchanged authentication policy to the vendored authority and add a
 * private correlation reference only to its exact generic temporary-failure response.
 */
export async function diagnosedGoogleAuthResponse(request, env = process.env, options = {}) {
  let stage = 'unknown';
  const mark = value => { stage = value; };
  let discoveryStage = 'unknown';
  try { discoveryStage = new URL(request.url).pathname === '/auth/login' ? 'login_discovery' : 'callback_discovery'; } catch {}

  const library = instrumentLibrary(options.library ?? oidc, mark, discoveryStage);
  const delegatedOptions = { db: instrumentDb(options.db, mark), now: options.now, library };
  if (typeof options.discover === 'function') {
    delegatedOptions.discover = async (...args) => {
      mark(discoveryStage);
      const result = await options.discover(...args);
      mark(discoveryStage === 'login_discovery' ? 'login_flow' : 'callback_flow');
      return result;
    };
  }

  const response = await googleAuthResponse(request, env, delegatedOptions);
  if (response.status !== 503) return response;
  const body = await response.clone().text();
  if (body !== TEMPORARILY_UNAVAILABLE) return response;

  const reference = `uc-auth-${randomBytes(8).toString('hex')}`;
  const headers = copiedHeaders(response);
  headers.set('X-Ummah-Auth-Reference', reference);
  const event = { event: 'ummah_staging_signin_unavailable', stage, reference };
  try {
    const onFailure = typeof options.onFailure === 'function'
      ? options.onFailure
      : value => console.error(JSON.stringify(value));
    Promise.resolve(onFailure(event)).catch(() => {});
  } catch {}
  return new Response(`${body}\nReference: ${reference}`, {
    status: response.status, statusText: response.statusText, headers,
  });
}
