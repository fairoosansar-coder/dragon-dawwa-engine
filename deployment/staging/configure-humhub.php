<?php
if(getenv('UMMAH_REVIEW_ENVIRONMENT')!=='isolated-staging'||getenv('RAILWAY_PROJECT_ID')!=='48d7a4cf-07dc-489b-8a3d-d6d10142b14e'||getenv('RAILWAY_ENVIRONMENT_ID')!=='1f7d98bf-1d49-4d9f-a5cc-13b57abcc095')throw new RuntimeException('Dedicated staging instance required.');
$host=getenv('HUMHUB_DB_HOST');$pass=getenv('HUMHUB_DB_PASSWORD');$key=getenv('HUMHUB_COOKIE_KEY');
if(!preg_match('/^[-a-z0-9]+\.railway\.internal$/D',$host?:'')||getenv('HUMHUB_DB_NAME')!=='ummah_humhub_staging'||getenv('HUMHUB_DB_USER')!=='ummah_humhub_app'||strlen($pass?:'')<32||strlen($key?:'')<32)throw new RuntimeException('Isolated HumHub database and cookie keys required.');
$storage='/var/lib/ummah-humhub';if(!is_dir($storage))mkdir($storage,0700,true);
chown($storage,'www-data');chgrp($storage,'www-data');chmod($storage,0700);
$dynamic=['components'=>['db'=>['class'=>'yii\\db\\Connection','dsn'=>'mysql:host='.$host.';dbname=ummah_humhub_staging','username'=>'ummah_humhub_app','password'=>$pass,'charset'=>'utf8mb4']]];
// installer/install-db writes installed-state metadata; retain it on restart.
if(is_file($storage.'/dynamic.php'))$dynamic=array_replace_recursive(require $storage.'/dynamic.php',$dynamic);
$web=['components'=>['request'=>['cookieValidationKey'=>$key]]];
$common=['components'=>['urlManager'=>['enablePrettyUrl'=>true,'showScriptName'=>false],'log'=>['targets'=>['yii\\log\\FileTarget'=>['logVars'=>[]],'yii\\log\\DbTarget'=>['logVars'=>[]]]]]];
foreach(['dynamic'=>$dynamic,'web'=>$web,'common'=>$common]as$name=>$config){$file=$storage.'/'.$name.'.php';file_put_contents($file,"<?php\nreturn ".var_export($config,true).";\n");chmod($file,0600);chown($file,'www-data');chgrp($file,'www-data');$target='/var/www/html/protected/config/'.$name.'.php';if(is_link($target))unlink($target);elseif(is_file($target))rename($target,$target.'.distribution');symlink($file,$target);}
foreach(['runtime'=>'/var/www/html/protected/runtime','uploads'=>'/var/www/html/uploads']as$name=>$target){$path=$storage.'/'.$name;if(!is_dir($path))mkdir($path,0700,true);chown($path,'www-data');chgrp($path,'www-data');if(!is_link($target)&&is_dir($target))rename($target,$target.'.distribution');if(!file_exists($target))symlink($path,$target);if(is_link($target)){lchown($target,'www-data');lchgrp($target,'www-data');}}
