#!/usr/bin/env bash
# Isolated public-runner qualification only. This script never deploys, pushes,
# uploads, or contacts a hosted environment.
set -Eeuo pipefail
umask 077

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROJECT_ID='48d7a4cf-07dc-489b-8a3d-d6d10142b14e'
ENVIRONMENT_ID='1f7d98bf-1d49-4d9f-a5cc-13b57abcc095'
DATABASE_NAME='ummah_humhub_staging'
DATABASE_USER='ummah_humhub_app'
REVIEW_SPACE_IDS='1,2'
HUMHUB_PORT='3401'
FIXTURE_PATH='/run/ummah-fixture/native-fixture.json'
TIMEOUT_SECONDS="${UMMAH_NATIVE_CI_TIMEOUT_SECONDS:-240}"

phase='preflight'
printf 'Native container phase: %s\n' "$phase"
network_created=0
mysql_volume_created=0
humhub_volume_created=0
fixture_volume_created=0
mysql_started=0
humhub_started=0

safe_token="${GITHUB_RUN_ID:-local}-$$-${RANDOM}"
safe_token="$(printf '%s' "$safe_token" | tr '[:upper:]_' '[:lower:]-' | tr -cd 'a-z0-9-' | cut -c1-36)"
[[ -n "$safe_token" ]] || safe_token="local-$$"
PREFIX="ummah-native-ci-${safe_token}"
NETWORK="${PREFIX}-network"
MYSQL_CONTAINER="${PREFIX}-mysql"
HUMHUB_CONTAINER="${PREFIX}-humhub"
MYSQL_VOLUME="${PREFIX}-mysql-data"
HUMHUB_VOLUME="${PREFIX}-humhub-data"
FIXTURE_VOLUME="${PREFIX}-fixture"
MYSQL_HOST="ummah-ci-${safe_token}.railway.internal"
HUMHUB_IMAGE="ummah-native-ci-humhub:${safe_token}"
APP_IMAGE="ummah-native-ci-app:${safe_token}"

RUNNER_PRIVATE_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/${PREFIX}"
mkdir -p -m 700 "$RUNNER_PRIVATE_ROOT"
COMMAND_LOG="${RUNNER_PRIVATE_ROOT}/commands.log"
HTTP_LOG="${RUNNER_PRIVATE_ROOT}/http-test.log"
MODEL_LOG="${RUNNER_PRIVATE_ROOT}/model-test.log"
FIXTURE_COPY="${RUNNER_PRIVATE_ROOT}/native-fixture.json"
HTTP_REPORT="${RUNNER_PRIVATE_ROOT}/http-native-report.json"
QUALIFICATION_REPORT="${RUNNER_PRIVATE_ROOT}/qualification-report.json"
: >"$COMMAND_LOG"
chmod 600 "$COMMAND_LOG"

quiet() {
    "$@" >>"$COMMAND_LOG" 2>&1
}

fail() {
    if [[ "$phase" == 'account-free-private-bootstrap' && "$humhub_started" == '1' ]]; then
        docker logs --tail 80 "$HUMHUB_CONTAINER" >"${RUNNER_PRIVATE_ROOT}/bootstrap-errors.log" 2>&1 || true
        PRIVATE_DIAGNOSTIC_PATH="${RUNNER_PRIVATE_ROOT}/bootstrap-errors.log" DIAGNOSTIC_APP_SECRET="${MYSQL_APP_PASSWORD:-}" DIAGNOSTIC_COOKIE_SECRET="${HUMHUB_COOKIE_KEY:-}" node --input-type=module - <<'NODE'
import {readFileSync} from 'node:fs';
const secrets=[process.env.DIAGNOSTIC_APP_SECRET,process.env.DIAGNOSTIC_COOKIE_SECRET].filter(Boolean);
const lines=readFileSync(process.env.PRIVATE_DIAGNOSTIC_PATH,'utf8').split('\n').filter(l=>/Fatal|Exception|Error|bootstrap|#[0-9]/i.test(l)).slice(-20);
const headers=lines.map(l=>secrets.reduce((v,k)=>v.replaceAll(k,'[redacted]'),l).replace(/[A-Za-z0-9_+\/=\-]{40,}/g,'[redacted]').slice(0,700));
console.log(JSON.stringify({kind:'sanitized-account-free-bootstrap-failure',headers}));
NODE
    fi
    printf 'Native container qualification: %s failed. See protected runner-local status files only.\n' "$phase" >&2
    exit 1
}

cleanup() {
    local status=$?
    trap - EXIT INT TERM
    # Only resources carrying this invocation's unique names are considered.
    if (( humhub_started )); then docker rm -f "$HUMHUB_CONTAINER" >/dev/null 2>&1 || true; fi
    if (( mysql_started )); then docker rm -f "$MYSQL_CONTAINER" >/dev/null 2>&1 || true; fi
    if (( fixture_volume_created )); then docker volume rm "$FIXTURE_VOLUME" >/dev/null 2>&1 || true; fi
    if (( humhub_volume_created )); then docker volume rm "$HUMHUB_VOLUME" >/dev/null 2>&1 || true; fi
    if (( mysql_volume_created )); then docker volume rm "$MYSQL_VOLUME" >/dev/null 2>&1 || true; fi
    if (( network_created )); then docker network rm "$NETWORK" >/dev/null 2>&1 || true; fi
    if (( status != 0 )); then
        printf 'Native container qualification: %s status=failed.\n' "$phase" >&2
    fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for tool in docker curl node openssl; do
    command -v "$tool" >/dev/null 2>&1 || fail
done
[[ "$TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || fail
[[ "$MYSQL_HOST" =~ ^[-a-z0-9]+\.railway\.internal$ ]] || fail

MYSQL_IMAGE="$(node --input-type=module - <<'NODE'
import {readFileSync} from 'node:fs';
const lock = JSON.parse(readFileSync('deployment/staging/upstream-lock.json', 'utf8'));
const image = lock?.mysql?.image;
if (typeof image !== 'string' || !/^docker\.io\/library\/mysql:8\.4@sha256:[a-f0-9]{64}$/.test(image)) {
  process.exit(1);
}
process.stdout.write(image);
NODE
)" || fail

random_secret() {
    openssl rand -hex 48
}
MYSQL_ROOT_PASSWORD="$(random_secret)" || fail
MYSQL_APP_PASSWORD="$(random_secret)" || fail
HUMHUB_COOKIE_KEY="$(random_secret)" || fail
# GitHub's masking command is emitted before any command that could write logs.
if [[ "${GITHUB_ACTIONS:-}" == 'true' ]]; then
    printf '::add-mask::%s\n' "$MYSQL_ROOT_PASSWORD"
    printf '::add-mask::%s\n' "$MYSQL_APP_PASSWORD"
    printf '::add-mask::%s\n' "$HUMHUB_COOKIE_KEY"
fi

wait_for_mysql() {
    local deadline=$((SECONDS + TIMEOUT_SECONDS))
    while (( SECONDS < deadline )); do
        if docker exec -e "MYSQL_PWD=$MYSQL_ROOT_PASSWORD" "$MYSQL_CONTAINER" mysql --protocol=TCP --host=127.0.0.1 -uroot --batch --skip-column-names --database="$DATABASE_NAME" -e 'SELECT 1' >/dev/null 2>>"$COMMAND_LOG"; then
            return 0
        fi
        sleep 2
    done
    return 1
}

mysql_scalar() {
    local sql="$1" result
    if ! result="$(docker exec -e "MYSQL_PWD=$MYSQL_ROOT_PASSWORD" "$MYSQL_CONTAINER" mysql -uroot --batch --skip-column-names -e "$sql" "$DATABASE_NAME" 2>>"$COMMAND_LOG")"; then
        return 1
    fi
    printf '%s' "$result"
}

wait_for_schema() {
    local deadline=$((SECONDS + TIMEOUT_SECONDS)) count triggers
    while (( SECONDS < deadline )); do
        count="$(mysql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DATABASE_NAME}' AND table_name IN ('user','space','ummah_review','ummah_review_event')")" || return 1
        triggers="$(mysql_scalar "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='${DATABASE_NAME}' AND trigger_name IN ('ummah_review_event_no_update','ummah_review_event_no_delete')")" || return 1
        if [[ "$count" == '4' && "$triggers" == '2' ]]; then
            return 0
        fi
        sleep 2
    done
    return 1
}

wait_for_http() {
    local deadline=$((SECONDS + TIMEOUT_SECONDS)) status
    while (( SECONDS < deadline )); do
        [[ "$(docker inspect --format '{{.State.Status}}' "$HUMHUB_CONTAINER" 2>>"$COMMAND_LOG")" == 'running' ]] || return 1
        if status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 5 "http://127.0.0.1:${HUMHUB_PORT}/api/v1/auth/current" 2>>"$COMMAND_LOG")"; then
            case "$status" in
                2*|3*|401) return 0 ;;
            esac
        fi
        sleep 2
    done
    return 1
}

assert_workers() {
    local supervisor_status
    if ! supervisor_status="$(docker exec "$HUMHUB_CONTAINER" supervisorctl -c /etc/supervisor/ummah-humhub.conf status 2>>"$COMMAND_LOG")"; then
        return 1
    fi
    grep -Eq '^apache[[:space:]]+RUNNING' <<<"$supervisor_status" \
        && grep -Eq '^humhub-queue[[:space:]]+RUNNING' <<<"$supervisor_status" \
        && grep -Eq '^humhub-cron[[:space:]]+RUNNING' <<<"$supervisor_status"
}

wait_for_workers() {
    local deadline=$((SECONDS + TIMEOUT_SECONDS))
    while (( SECONDS < deadline )); do
        if assert_workers; then
            return 0
        fi
        sleep 2
    done
    return 1
}

assert_protected_paths() {
    local path status
    for path in '/protected/config/dynamic.php' '/protected/runtime/' '/uploads/file/'; do
        status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 5 --path-as-is "http://127.0.0.1:${HUMHUB_PORT}${path}" 2>>"$COMMAND_LOG")" || return 1
        case "$status" in
            403|404) ;;
            *) printf 'Native protected path failure: %s status=%s\n' "$path" "$status"; return 1 ;;
        esac
    done
}

start_humhub() {
    local initialize="$1" private_bootstrap="${2:-no}" ids="$REVIEW_SPACE_IDS"
    if [[ "$private_bootstrap" == yes ]]; then ids=''; fi
    quiet docker run -d \
        --name "$HUMHUB_CONTAINER" \
        --network "$NETWORK" \
        --entrypoint /bin/sh \
        -p "127.0.0.1:${HUMHUB_PORT}:80" \
        -v "${HUMHUB_VOLUME}:/var/lib/ummah-humhub" \
        -v "${FIXTURE_VOLUME}:/run/ummah-fixture" \
        --env "HUMHUB_DB_HOST=${MYSQL_HOST}" \
        --env "HUMHUB_DB_NAME=${DATABASE_NAME}" \
        --env "HUMHUB_DB_USER=${DATABASE_USER}" \
        --env "HUMHUB_DB_PASSWORD=${MYSQL_APP_PASSWORD}" \
        --env "HUMHUB_COOKIE_KEY=${HUMHUB_COOKIE_KEY}" \
        --env "RAILWAY_PROJECT_ID=${PROJECT_ID}" \
        --env "RAILWAY_ENVIRONMENT_ID=${ENVIRONMENT_ID}" \
        --env "ENV=${ENVIRONMENT_ID}" \
        --env 'UMMAH_REVIEW_ENVIRONMENT=isolated-staging' \
        --env "UMMAH_REVIEW_SPACE_IDS=${ids}" \
        --env "UMMAH_BOOTSTRAP_PRIVATE_EMPTY=${private_bootstrap}" \
        --env "SPACE_IDS=${REVIEW_SPACE_IDS}" \
        --env "UMMAH_INITIALIZE_HUMHUB=${initialize}" \
        "$HUMHUB_IMAGE" -c 'if [ "$UMMAH_INITIALIZE_HUMHUB" = yes ] && [ "$UMMAH_BOOTSTRAP_PRIVATE_EMPTY" = yes ]; then ln -sf ../mods-available/mpm_event.load /etc/apache2/mods-enabled/mpm_event.load; ln -sf ../mods-available/mpm_event.conf /etc/apache2/mods-enabled/mpm_event.conf; fi; exec /usr/local/bin/start-humhub' || return 1
    humhub_started=1
}

phase='docker-preflight'
printf 'Native container phase: %s\n' "$phase"
quiet docker version || fail

phase='build-pinned-images'
printf 'Native container phase: %s\n' "$phase"
quiet docker build --file deployment/staging/humhub.Dockerfile --tag "$HUMHUB_IMAGE" . || fail
# The application image is deliberately built only; it is never started or published.
quiet docker build --file deployment/staging/app.Dockerfile --tag "$APP_IMAGE" . || fail

phase='create-isolated-docker-resources'
printf 'Native container phase: %s\n' "$phase"
quiet docker network create --driver bridge "$NETWORK" || fail
network_created=1
quiet docker volume create "$MYSQL_VOLUME" || fail
mysql_volume_created=1
quiet docker volume create "$HUMHUB_VOLUME" || fail
humhub_volume_created=1
quiet docker volume create "$FIXTURE_VOLUME" || fail
fixture_volume_created=1

phase='start-pinned-mysql'
printf 'Native container phase: %s\n' "$phase"
quiet docker run -d \
    --name "$MYSQL_CONTAINER" \
    --network "$NETWORK" \
    --network-alias "$MYSQL_HOST" \
    -v "${MYSQL_VOLUME}:/var/lib/mysql" \
    --env "MYSQL_DATABASE=${DATABASE_NAME}" \
    --env "MYSQL_USER=${DATABASE_USER}" \
    --env "MYSQL_PASSWORD=${MYSQL_APP_PASSWORD}" \
    --env "MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}" \
    "$MYSQL_IMAGE" \
    --skip-log-bin \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_0900_ai_ci || fail
mysql_started=1
wait_for_mysql || fail

phase='configure-scoped-migration-role'
printf 'Native container phase: %s\n' "$phase"
# This one disposable MySQL instance has binary logging disabled. The app role
# receives only schema-local trigger capability; no SUPER-like global grant.
quiet docker exec -e "MYSQL_PWD=${MYSQL_ROOT_PASSWORD}" "$MYSQL_CONTAINER" mysql -uroot -e "GRANT TRIGGER ON \`${DATABASE_NAME}\`.* TO '${DATABASE_USER}'@'%'; FLUSH PRIVILEGES;" || fail
log_bin="$(mysql_scalar 'SELECT @@log_bin')" || fail
[[ "$log_bin" == '0' ]] || fail

phase='account-free-private-bootstrap'
printf 'Native container phase: %s\n' "$phase"
start_humhub 'yes' 'yes' || fail
wait_for_http || fail
wait_for_schema || fail
wait_for_workers || fail
quiet docker exec "$HUMHUB_CONTAINER" sh -c 'set -- /etc/apache2/mods-enabled/mpm_*.load; [ "$#" -eq 1 ] && [ "$1" = /etc/apache2/mods-enabled/mpm_prefork.load ] && apache2ctl -t' || fail
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM user')" == '0' ]] || fail
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM post')" == '0' ]] || fail
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM space_membership')" == '0' ]] || fail
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM ummah_review_grant')" == '0' ]] || fail
[[ "$(mysql_scalar "SELECT COUNT(*) FROM space WHERE name='UmmahConnect Staging Review' AND visibility=0 AND join_policy=0 AND auto_add_new_members=0 AND default_content_visibility=0")" == '1' ]] || fail
private_space_before="$(mysql_scalar "SELECT id FROM space WHERE name='UmmahConnect Staging Review'")" || fail
private_container_before="$(mysql_scalar "SELECT contentcontainer_id FROM space WHERE id=${private_space_before}")" || fail
quiet docker stop "$HUMHUB_CONTAINER" || fail
quiet docker rm "$HUMHUB_CONTAINER" || fail
humhub_started=0
start_humhub 'no' 'yes' || fail
wait_for_http || fail
wait_for_workers || fail
[[ "$(mysql_scalar "SELECT id FROM space WHERE name='UmmahConnect Staging Review'")" == "$private_space_before" ]] || fail
[[ "$(mysql_scalar "SELECT contentcontainer_id FROM space WHERE id=${private_space_before}")" == "$private_container_before" ]] || fail
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM user')" == '0' ]] || fail
assert_protected_paths || fail
printf '%s\n' '{"kind":"native-account-free-bootstrap","privateCommunityCreated":true,"users":0,"posts":0,"memberships":0,"grants":0,"actualSpaceIdResolved":true,"privatePersistentRestart":"pass","humanParticipation":false}'
quiet docker stop "$HUMHUB_CONTAINER" || fail
quiet docker rm "$HUMHUB_CONTAINER" || fail
humhub_started=0

phase='initialize-humhub'
printf 'Native container phase: %s\n' "$phase"
start_humhub 'no' || fail
wait_for_http || fail

phase='apply-native-migrations'
printf 'Native container phase: %s\n' "$phase"
quiet docker exec "$HUMHUB_CONTAINER" php /var/www/html/protected/yii migrate/up --includeModuleMigrations=1 --interactive=0 || fail
wait_for_schema || fail

phase='runtime-readiness'
printf 'Native container phase: %s\n' "$phase"
wait_for_http || fail
wait_for_workers || fail
assert_protected_paths || fail
docker exec --user www-data "$HUMHUB_CONTAINER" php -r 'clearstatcache(); $ok=is_dir("/var/www/html/uploads")&&is_writable("/var/www/html/uploads"); echo json_encode(["kind"=>"native-storage-readiness","traversableWritable"=>$ok]),PHP_EOL; if(!$ok) exit(1);' || fail

phase='prepare-private-native-fixture'
printf 'Native container phase: %s\n' "$phase"
quiet docker exec "$HUMHUB_CONTAINER" sh -c 'mkdir -p /run/ummah-fixture && chmod 700 /run/ummah-fixture' || fail
for source in scripts/seed-native-humhub.php scripts/native-fixture-db.php scripts/test-native-model-guards.php scripts/configure-native-rest-fixture.php; do
    quiet docker cp "$source" "${HUMHUB_CONTAINER}:/tmp/$(basename "$source")" || fail
done
quiet docker exec \
    --env 'UMMAH_NATIVE_FIXTURE=sandbox-only' \
    --env 'UMMAH_REVIEW_ENVIRONMENT=isolated-staging' \
    --env "UMMAH_REVIEW_SPACE_IDS=${REVIEW_SPACE_IDS}" \
    --env "SPACE_IDS=${REVIEW_SPACE_IDS}" \
    --env 'HUMHUB_ROOT=/var/www/html' \
    --env "UMMAH_NATIVE_FIXTURE_FILE=${FIXTURE_PATH}" \
    "$HUMHUB_CONTAINER" php /tmp/seed-native-humhub.php || fail
quiet docker exec \
    --env 'UMMAH_NATIVE_FIXTURE=sandbox-only' \
    --env 'UMMAH_REVIEW_ENVIRONMENT=isolated-staging' \
    --env "UMMAH_REVIEW_SPACE_IDS=${REVIEW_SPACE_IDS}" \
    --env 'HUMHUB_ROOT=/var/www/html' \
    --env "UMMAH_NATIVE_FIXTURE_FILE=${FIXTURE_PATH}" \
    "$HUMHUB_CONTAINER" php /tmp/configure-native-rest-fixture.php || fail
quiet docker exec "$HUMHUB_CONTAINER" sh -c "test -f '${FIXTURE_PATH}' && test \$(stat -c '%a' '${FIXTURE_PATH}') = 600" || fail
quiet docker cp "${HUMHUB_CONTAINER}:${FIXTURE_PATH}" "$FIXTURE_COPY" || fail
chmod 600 "$FIXTURE_COPY"
[[ ! -O "$FIXTURE_COPY" || -r "$FIXTURE_COPY" ]] || fail
quiet docker exec "$HUMHUB_CONTAINER" chown -R www-data:www-data /var/lib/ummah-humhub/runtime /var/lib/ummah-humhub/uploads /var/www/html/assets || fail

DB_PROBE_COMMAND_JSON="$(DB_PROBE_CONTAINER="$HUMHUB_CONTAINER" DB_PROBE_FIXTURE_PATH="$FIXTURE_PATH" node --input-type=module - <<'NODE'
const command = [
  'docker', 'exec', '-i', process.env.DB_PROBE_CONTAINER, 'env',
  'UMMAH_NATIVE_FIXTURE=sandbox-only',
  'UMMAH_REVIEW_ENVIRONMENT=isolated-staging',
  'UMMAH_REVIEW_SPACE_IDS=1,2',
  'SPACE_IDS=1,2',
  'HUMHUB_ROOT=/var/www/html',
  `UMMAH_NATIVE_FIXTURE_FILE=${process.env.DB_PROBE_FIXTURE_PATH}`,
  'php', '/tmp/native-fixture-db.php',
];
process.stdout.write(JSON.stringify(command));
NODE
)" || fail

phase='native-http-qualification'
printf 'Native container phase: %s\n' "$phase"
if ! env \
    UMMAH_NATIVE_FIXTURE=sandbox-only \
    UMMAH_NATIVE_FIXTURE_FILE="$FIXTURE_COPY" \
    UMMAH_NATIVE_DB_COMMAND_JSON="$DB_PROBE_COMMAND_JSON" \
    UMMAH_NATIVE_DB_DESCRIPTION='MySQL 8.4 in an ephemeral isolated Docker container; not hosted MySQL qualification' \
    UMMAH_NATIVE_REPORT_FILE="$HTTP_REPORT" \
    node scripts/test-native-humhub.mjs >"$HTTP_LOG" 2>&1; then
    HTTP_REPORT_PATH="$HTTP_REPORT" FIXTURE_REPORT_PATH="$FIXTURE_COPY" node --input-type=module - <<'NODE'
import {readFileSync,existsSync} from 'node:fs';
if(existsSync(process.env.HTTP_REPORT_PATH)){
 const report=JSON.parse(readFileSync(process.env.HTTP_REPORT_PATH,'utf8'));
 const fixture=JSON.parse(readFileSync(process.env.FIXTURE_REPORT_PATH,'utf8'));
 const secrets=Object.values(fixture.accounts).flatMap(a=>[a.token,a.password]);
 const redact=s=>secrets.reduce((v,k)=>v.replaceAll(k,'[redacted]'),String(s||'')).replace(/[A-Za-z0-9_+\/=\-]{32,}/g,'[redacted]').slice(0,350);
 console.log(JSON.stringify({kind:'native-container-failure-summary',passed:report.passed,failed:report.failed,failures:report.results.filter(r=>r.status==='fail').map(r=>({name:r.name,error:redact(r.error)}))}));
} else console.log('Native report unavailable; no raw runtime log disclosed.');
NODE
    if docker cp "${HUMHUB_CONTAINER}:/var/lib/ummah-humhub/runtime/logs/app.log" "${RUNNER_PRIVATE_ROOT}/native-private-error.log" >/dev/null 2>&1; then
      ERROR_HEADER_PATH="${RUNNER_PRIVATE_ROOT}/native-private-error.log" FIXTURE_REPORT_PATH="$FIXTURE_COPY" node --input-type=module - <<'NODE'
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(process.env.FIXTURE_REPORT_PATH,'utf8'));
const secrets=Object.values(fixture.accounts).flatMap(a=>[a.token,a.password]);
const lines=readFileSync(process.env.ERROR_HEADER_PATH,'utf8').split('\n').filter(l=>/^20\d\d-/.test(l)&&l.includes('[error]')&&!/HttpException:40[139]|HttpException:503/.test(l)).slice(-6);
const headers=lines.map(l=>secrets.reduce((v,k)=>v.replaceAll(k,'[redacted]'),l).replace(/[A-Za-z0-9_+\/=\-]{32,}/g,'[redacted]').slice(0,650));
console.log(JSON.stringify({kind:'native-redacted-exception-headers',headers}));
NODE
    fi
    docker exec --user www-data "$HUMHUB_CONTAINER" php -r 'foreach(["/var/lib/ummah-humhub","/var/lib/ummah-humhub/uploads","/var/www/html/uploads"] as $p){clearstatcache(true,$p);echo json_encode(["kind"=>"native-storage-diagnostic","path"=>$p,"uid"=>posix_geteuid(),"gid"=>posix_getegid(),"exists"=>file_exists($p),"directory"=>is_dir($p),"readable"=>is_readable($p),"writable"=>is_writable($p),"symlink"=>is_link($p),"realpath"=>realpath($p)]),PHP_EOL;}' || true
    docker exec "$HUMHUB_CONTAINER" stat -c 'Native storage mode: %a %u %g %n' /var/lib/ummah-humhub /var/lib/ummah-humhub/uploads /var/www/html/uploads || true
    fail
fi
chmod 600 "$HTTP_REPORT" "$HTTP_LOG"

phase='native-model-guard-qualification'
printf 'Native container phase: %s\n' "$phase"
if ! docker exec \
    --env 'UMMAH_NATIVE_FIXTURE=sandbox-only' \
    --env 'UMMAH_REVIEW_ENVIRONMENT=isolated-staging' \
    --env "UMMAH_REVIEW_SPACE_IDS=${REVIEW_SPACE_IDS}" \
    --env "SPACE_IDS=${REVIEW_SPACE_IDS}" \
    --env 'HUMHUB_ROOT=/var/www/html' \
    --env 'UMMAH_NATIVE_DB_DESCRIPTION=MySQL 8.4 in an ephemeral isolated Docker container; not hosted qualification' \
    --env "UMMAH_NATIVE_FIXTURE_FILE=${FIXTURE_PATH}" \
    "$HUMHUB_CONTAINER" php /tmp/test-native-model-guards.php >"$MODEL_LOG" 2>&1; then
    fail
fi
chmod 600 "$MODEL_LOG"

phase='verify-persistence-before-restart'
printf 'Native container phase: %s\n' "$phase"
review_count_before="$(mysql_scalar 'SELECT COUNT(*) FROM ummah_review')" || fail
event_count_before="$(mysql_scalar 'SELECT COUNT(*) FROM ummah_review_event')" || fail
fixture_count_before="$(mysql_scalar "SELECT COUNT(*) FROM user WHERE username IN ('ummah-author','ummah-reviewer','ummah-excluded')")" || fail
[[ "$(mysql_scalar "SELECT COUNT(*) FROM ummah_review WHERE space_id<>${private_space_before}")" == '0' ]] || fail

phase='reject-first-boot-over-existing-accounts'
printf 'Native container phase: %s\n' "$phase"
if docker exec --env 'UMMAH_INITIALIZE_HUMHUB=yes' --env 'UMMAH_BOOTSTRAP_PRIVATE_EMPTY=yes' "$HUMHUB_CONTAINER" php /usr/local/bin/bootstrap-private-humhub.php --assert-empty >>"$COMMAND_LOG" 2>&1; then fail; fi
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM ummah_review')" == "$review_count_before" ]] || fail
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM ummah_review_event')" == "$event_count_before" ]] || fail
[[ "$(mysql_scalar "SELECT COUNT(*) FROM user WHERE username IN ('ummah-author','ummah-reviewer','ummah-excluded')")" == "$fixture_count_before" ]] || fail

phase='restart-with-persistent-volumes'
printf 'Native container phase: %s\n' "$phase"
quiet docker stop "$HUMHUB_CONTAINER" || fail
quiet docker rm "$HUMHUB_CONTAINER" || fail
humhub_started=0
# Recreate against the same volumes with initialization disabled. This catches
# destructive writes that a plain Docker restart would conceal.
start_humhub 'no' 'yes' || fail
wait_for_http || fail
wait_for_schema || fail
wait_for_workers || fail
assert_protected_paths || fail

phase='verify-persistence-after-restart'
printf 'Native container phase: %s\n' "$phase"
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM ummah_review')" == "$review_count_before" ]] || fail
[[ "$(mysql_scalar 'SELECT COUNT(*) FROM ummah_review_event')" == "$event_count_before" ]] || fail
[[ "$(mysql_scalar "SELECT COUNT(*) FROM user WHERE username IN ('ummah-author','ummah-reviewer','ummah-excluded')")" == "$fixture_count_before" ]] || fail
[[ "$(mysql_scalar "SELECT COUNT(*) FROM ummah_review WHERE space_id<>${private_space_before}")" == '0' ]] || fail
quiet docker exec "$HUMHUB_CONTAINER" sh -c "test -f '${FIXTURE_PATH}' && test \$(stat -c '%a' '${FIXTURE_PATH}') = 600" || fail

phase='write-runner-local-report'
printf 'Native container phase: %s\n' "$phase"
QUALIFICATION_REPORT_PATH="$QUALIFICATION_REPORT" HTTP_REPORT_PATH="$HTTP_REPORT" node --input-type=module - <<'NODE' >>"$COMMAND_LOG" 2>&1
import {writeFileSync} from 'node:fs';
writeFileSync(process.env.QUALIFICATION_REPORT_PATH, JSON.stringify({
  kind: 'isolated-native-container-qualification',
  database: 'MySQL 8.4 in an ephemeral isolated Docker container',
  databasePublished: false,
  humhubPublished: '127.0.0.1:3401 only',
  hostedEnvironmentContacted: false,
  projectAndEnvironmentIds: 'configuration-contract fixtures only; not hosting evidence',
  humanParticipation: false,
  realGoogleLoginTested: false,
  physicalIPhoneSafariTested: false,
  reports: {http: process.env.HTTP_REPORT_PATH},
  persistence: 'verified after stop/recreate against the same named volumes',
}, null, 2) + '\n', {mode: 0o600});
NODE
chmod 600 "$QUALIFICATION_REPORT"
HTTP_REPORT_PATH="$HTTP_REPORT" MODEL_LOG_PATH="$MODEL_LOG" node --input-type=module - <<'NODE'
import {readFileSync} from 'node:fs';
const http=JSON.parse(readFileSync(process.env.HTTP_REPORT_PATH,'utf8'));
const model=JSON.parse(readFileSync(process.env.MODEL_LOG_PATH,'utf8').trim().split('\n').at(-1));
if(http.failed || model.failed || http.passed<32 || model.passed<16)process.exit(1);
console.log(JSON.stringify({kind:'actual-native-container-summary',mysql:'8.4',httpPassed:http.passed,modelPassed:model.passed,failed:0,appImageBuilt:true,humhubImageBuilt:true,queueCronWorkers:'pass',persistentRestart:'pass',accountFreePrivateBootstrap:'pass',apacheDuplicateMpmRecovery:'pass',ordinaryGuestPrivateSpaceDenied:'pass',firstBootOverExistingAccountsDenied:'pass',privateMarkerRestartWithAccounts:'pass',humanParticipation:false,realGoogleLoginTested:false,physicalIPhoneSafariTested:false,hostedEnvironmentTested:false}));
NODE
printf 'Native container qualification passed: MySQL 8.4 ran in an ephemeral isolated container; HumHub was loopback-only; synthetic fixtures only.\n'
