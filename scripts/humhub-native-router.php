<?php
// Native provider qualification only; PHP built-in server is NOT the hosted deployment.
if (getenv('UMMAH_NATIVE_FIXTURE') !== 'sandbox-only' || getenv('UMMAH_REVIEW_ENVIRONMENT') !== 'isolated-staging') {
    http_response_code(503); exit('Native test isolation is required.');
}
$root=realpath(getenv('HUMHUB_ROOT') ?: '');
if (!$root || ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1' || ($_SERVER['HTTP_HOST'] ?? '') !== '127.0.0.1:3401') { http_response_code(503); exit('Loopback-only qualification runtime.'); }
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if (preg_match('#^/(protected|uploads/file|\.env)(/|$)#',$path) || str_contains($path,'..')) { http_response_code(404); exit; }
$_SERVER['SCRIPT_FILENAME']=$root.'/index.php'; $_SERVER['SCRIPT_NAME']='/index.php'; $_SERVER['PHP_SELF']='/index.php';
require $root.'/index.php';
