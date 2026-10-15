<?php
if(getenv('UMMAH_REVIEW_ENVIRONMENT')!=='isolated-staging'||getenv('UMMAH_NATIVE_FIXTURE')!=='sandbox-only')throw new RuntimeException('Sandbox qualification only.');
$root=realpath(getenv('HUMHUB_ROOT')?:'');$file=getenv('UMMAH_NATIVE_FIXTURE_FILE');
if(!$root||!$file||(fileperms($file)&0077))throw new RuntimeException('Protected fixture required.');
$f=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
if(($f['kind']??'')!=='native-humhub-sandbox-fixture')throw new RuntimeException('Not a native fixture.');
$_SERVER['SCRIPT_FILENAME']=$root.'/index.php';$_SERVER['SCRIPT_NAME']='/index.php';$_SERVER['HTTP_HOST']='127.0.0.1:3401';$_SERVER['REQUEST_URI']='/';
define('YII_DEBUG',false);define('YII_ENV','prod');require $root.'/protected/vendor/autoload.php';require $root.'/protected/vendor/yiisoft/yii2/Yii.php';Yii::setAlias('@humhub',$root.'/protected/humhub');
$bootstrap=new humhub\services\BootstrapService();$config=$bootstrap->getConfig('web');$config['components']['user']['enableSession']=false;$app=new humhub\components\Application($config);
use humhub\modules\user\models\User;
use humhub\modules\space\models\Space;
use humhub\modules\post\models\Post;
use humhub\modules\content\models\Content;
use yii\base\Event;
$app->user->switchIdentity(User::findOne($f['accounts']['author']['id']));$space=Space::findOne($f['spaceId']);$results=[];
function checkNative($name,$fn){global $results;try{$fn();$results[]=['name'=>$name,'status'=>'pass'];echo 'PASS '.$name."\n";}catch(Throwable $e){$results[]=['name'=>$name,'status'=>'fail','error'=>substr($e->getMessage(),0,300)];echo 'FAIL '.$name.' '.substr($e->getMessage(),0,300)."\n";}}
function must($ok,$message){if(!$ok)throw new RuntimeException($message);}
$post=null;$firstStates=[];
Event::on(Content::class,Content::EVENT_AFTER_INSERT,function($event)use(&$firstStates){$c=$event->sender;if($c->object_model===Post::class)$firstStates[]=(int)$c->state;});
checkNative('Native Post::save first Content INSERT is draft, never briefly published',function()use($space,&$post,&$firstStates){$post=new Post($space,['message'=>'Native bypass fixture, not genuine scholarship.','title'=>'Native guard qualification']);$post->content->state=Content::STATE_PUBLISHED;$post->content->visibility=Content::VISIBILITY_PUBLIC;must($post->save(),'Save rejected unexpectedly');must($firstStates===[Content::STATE_DRAFT],'Observed non-draft first insert');must((int)$post->content->state===Content::STATE_DRAFT,'Final state is not draft');must((int)$post->content->visibility===Content::VISIBILITY_PRIVATE,'Content became public');});
checkNative('Unreviewed native state-service publishing blocked',function()use(&$post){must($post,'Missing post');must(!$post->content->getStateService()->publish(),'Unreviewed publication succeeded');$post->content->refresh();must((int)$post->content->state===Content::STATE_DRAFT,'Unreviewed state changed');});
checkNative('Unreviewed scheduled publication blocked',function()use(&$post){$post->content->state=Content::STATE_SCHEDULED;$post->content->scheduled_at='2099-01-01 00:00:00';must(!$post->content->save(false),'Scheduling bypass succeeded');$post->content->refresh();must((int)$post->content->state===Content::STATE_DRAFT,'Draft lost');});
checkNative('Approved message cannot mutate through native Post::save',function()use($app){$row=$app->db->createCommand("SELECT post_id FROM ummah_review WHERE status='approved' ORDER BY id DESC LIMIT 1")->queryOne();must($row,'No approved fixture');$p=Post::findOne($row['post_id']);$before=$p->message;$p->message='Unauthorized altered scholarly claim';must(!$p->save(false),'Approved mutation succeeded');$p->refresh();must($p->message===$before,'Approved content changed');});
checkNative('Rejected post cannot publish through native state service',function()use($app){$row=$app->db->createCommand("SELECT post_id FROM ummah_review WHERE status='rejected' ORDER BY id DESC LIMIT 1")->queryOne();must($row,'No rejected fixture');$p=Post::findOne($row['post_id']);must(!$p->content->getStateService()->publish(),'Rejected native publication succeeded');$p->content->refresh();must((int)$p->content->state===Content::STATE_DRAFT,'Rejected content left draft');});
$report=['kind'=>'actual-humhub-native-model-guards','transport'=>'native Yii models with real MariaDB','results'=>$results,'passed'=>count(array_filter($results,fn($r)=>$r['status']==='pass')),'failed'=>count(array_filter($results,fn($r)=>$r['status']==='fail')),'humanParticipation'=>false,'physicalIPhoneSafariTested'=>false];
if(getenv('UMMAH_NATIVE_MODEL_REPORT_FILE'))file_put_contents(getenv('UMMAH_NATIVE_MODEL_REPORT_FILE'),json_encode($report,JSON_PRETTY_PRINT)."\n");echo json_encode(['passed'=>$report['passed'],'failed'=>$report['failed']]),"\n";exit($report['failed']?1:0);
