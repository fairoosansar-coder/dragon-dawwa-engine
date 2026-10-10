#!/usr/bin/env python3
"""Server-only provider configuration and Quran Content API client.
Default CLI checks configuration presence only. --live makes provider requests.
No credentials or OAuth tokens are printed. Python standard library only.
"""
import argparse
import base64
import json
import os
import time
import threading
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener
from sunnah_api_tool import NoRedirect, PipelineError, MAX_BYTES, gemini_json, request_json

class QuranClient:
    def __init__(self):
        self.client_id = os.getenv('QURAN_CLIENT_ID', '')
        self.secret = os.getenv('QURAN_CLIENT_SECRET', '')
        environment = os.getenv('QURAN_ENV', 'prelive')
        if not self.client_id or not self.secret or environment not in ('prelive', 'production'):
            raise PipelineError('CONFIG_ERROR', 'Set Quran client credentials and a valid QURAN_ENV.')
        self.auth = 'https://oauth2.quran.foundation' if environment == 'production' else 'https://prelive-oauth2.quran.foundation'
        self.api = 'https://apis.quran.foundation' if environment == 'production' else 'https://apis-prelive.quran.foundation'
        self._token, self._expires = '', 0
        self._lock = threading.Lock()

    def _request(self, req):
        try:
            with build_opener(NoRedirect()).open(req, timeout=20) as res:
                raw = res.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES: raise ValueError()
                data = json.loads(raw)
                if not isinstance(data, dict): raise ValueError()
                return data
        except HTTPError:
            raise  # Caller inspects status only, never response bodies or headers.
        except (OSError, URLError):
            raise PipelineError('API_ERROR', 'Quran provider unreachable.') from None
        except (ValueError, UnicodeError):
            raise PipelineError('INVALID_RESPONSE', 'Invalid Quran provider response.') from None

    def _access_token(self):
        with self._lock:
            if self._token and time.monotonic() < self._expires:
                return self._token
            basic = base64.b64encode(f'{self.client_id}:{self.secret}'.encode()).decode()
            req = Request(self.auth + '/oauth2/token', method='POST',
                headers={'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded'},
                data=b'grant_type=client_credentials&scope=content')
            token = self._request(req)
            if not isinstance(token.get('access_token'), str) or not token['access_token'] or not isinstance(token.get('expires_in'), (int, float)) or token['expires_in'] <= 0:
                raise PipelineError('INVALID_RESPONSE', 'Quran OAuth response missing token or expiry.')
            self._token = token['access_token']; self._expires = time.monotonic() + max(0, token['expires_in'] - 60)
            return self._token

    def get_chapters(self, language='en'):
        if language not in ('en', 'ar', 'ta', 'si'):
            raise PipelineError('INVALID_INPUT', 'Unsupported language.')
        for attempt in range(2):
            try:
                token = self._access_token()
                req = Request(self.api + '/content/api/v4/chapters?' + urlencode({'language': language}),
                    headers={'x-auth-token': token, 'x-client-id': self.client_id, 'Accept': 'application/json'})
                data = self._request(req)
                if not isinstance(data.get('chapters'), list) or not data['chapters']:
                    raise PipelineError('INVALID_RESPONSE', 'Quran chapter catalogue is missing.')
                return data
            except HTTPError as exc:
                if exc.code == 401 and attempt == 0:
                    with self._lock: self._token, self._expires = '', 0
                    continue
                raise PipelineError('ACCESS_DENIED' if exc.code in (401,403) else 'API_ERROR', f'Quran provider returned HTTP {exc.code}.') from None

def configuration_status():
    groups = {'sunnah': ['SUNNAH_API_KEY'], 'quran': ['QURAN_CLIENT_ID', 'QURAN_CLIENT_SECRET'], 'gemini': ['GEMINI_API_KEY', 'GEMINI_MODEL']}
    status = {name: {'configured': all(os.getenv(k) for k in keys), 'missing': [k for k in keys if not os.getenv(k)], 'live_verified': False} for name, keys in groups.items()}
    status['sunnah']['search_contract_confirmed'] = os.getenv('SUNNAH_SEARCH_CONTRACT_CONFIRMED') == '1' and bool(os.getenv('SUNNAH_SEARCH_QUERY_PARAM'))
    status['quran']['environment'] = os.getenv('QURAN_ENV', 'prelive')
    return status

def onboard(live=False):
    status = configuration_status()
    if live:
        # Sunnah documented collections endpoint verifies the key, NOT fuzzy search.
        calls = {'sunnah': lambda: request_json('https://api.sunnah.com/v1/collections', headers={'X-API-Key': os.getenv('SUNNAH_API_KEY', '')}),
                 'quran': lambda: QuranClient().get_chapters(),
                 'gemini': lambda: gemini_json('Return exactly {"ok":true}.', {'task': 'connectivity_check'})}
        for name, call in calls.items():
            if not status[name]['configured']: continue
            try:
                result = call()
                if name == 'sunnah' and (not isinstance(result, dict) or not isinstance(result.get('data'), list) or not result['data']):
                    raise PipelineError('INVALID_RESPONSE', 'Sunnah collections response invalid.')
                if name == 'gemini' and result != {'ok': True}:
                    raise PipelineError('MODEL_ERROR', 'Gemini connectivity output invalid.')
                status[name]['live_verified'] = True
            except PipelineError as exc: status[name]['error'] = str(exc)
    return status

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Make API calls, including a small billable Gemini request.')
    args = parser.parse_args(); print(json.dumps(onboard(args.live), indent=2))
