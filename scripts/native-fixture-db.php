<?php
/** Private CLI probe. Not an HTTP controller and never real-account administration. */
if (getenv('UMMAH_NATIVE_FIXTURE') !== 'sandbox-only' || getenv('UMMAH_REVIEW_ENVIRONMENT') !== 'isolated-staging') throw new RuntimeException('Sandbox fixture only.');
$root=realpath(getenv('HUMHUB_ROOT')?:''); $file=getenv('UMMAH_NATIVE_FIXTURE_FILE');
if(!$root||!$file||!is_file($file)||(fileperms($file)&0077))throw new RuntimeException('Protected fixture required.');
$f=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);
if(($f['kind']??'')!=='native-humhub-sandbox-fixture')throw new RuntimeException('Refuse non-fixture.');
$input=json_decode(stream_get_contents(STDIN),true,8,JSON_THROW_ON_ERROR);
$_SERVER['SCRIPT_FILENAME']=$root.'/index.php'; $_SERVER['SCRIPT_NAME']='/index.php'; $_SERVER['HTTP_HOST']='127.0.0.1:3401'; $_SERVER['REQUEST_URI']='/';
define('YII_DEBUG',false);define('YII_ENV','prod');require $root.'/protected/vendor/autoload.php';require $root.'/protected/vendor/yiisoft/yii2/Yii.php';Yii::setAlias('@humhub',$root.'/protected/humhub');
$config=(new humhub\services\BootstrapService())->getConfig('web');$config['components']['user']['enableSession']=false;$app=new humhub\components\Application($config);
$op=$input['operation']??'';$id=(int)($input['reviewId']??0);$db=$app->db;
if($op==='meta'){
 $row=$db->createCommand('SELECT contentcontainer_id FROM space WHERE id=:id',[':id'=>$f['spaceId']])->queryOne();
 echo json_encode(['containerId'=>(int)$row['contentcontainer_id']]),"\n";exit;
}
$row=$db->createCommand('SELECT r.*,p.message,c.state,c.visibility FROM ummah_review r INNER JOIN post p ON p.id=r.post_id INNER JOIN content c ON c.id=r.content_id WHERE r.id=:id',[':id'=>$id])->queryOne();
if(!$row||(int)$row['space_id']!==(int)$f['spaceId']||!in_array((int)$row['author_id'],[(int)$f['accounts']['author']['id'],(int)$f['accounts']['reviewer']['id']],true))throw new RuntimeException('Fixture review required.');
$trigger='ummah_fixture_publish_fail_'.$id;
switch($op){
 case 'inspect':
  $audit=$db->createCommand('SELECT phase,outcome,reason,decision,operation_key,version_hash FROM ummah_review_event WHERE review_id=:id OR requested_review_id=:id ORDER BY id',[':id'=>$id])->queryAll();
  $notifications=(int)$db->createCommand('SELECT COUNT(*) FROM notification WHERE source_class=:model AND source_pk=:id',[':model'=>humhub\modules\post\models\Post::class,':id'=>$row['post_id']])->queryScalar();
  echo json_encode(['status'=>$row['status'],'state'=>(int)$row['state'],'visibility'=>(int)$row['visibility'],'messageHashMatches'=>hash_equals($row['message_hash'],hash('sha256',$row['message'])),'audit'=>$audit,'notifications'=>$notifications]),"\n";break;
 case 'fail-publication-on':
  $db->createCommand('CREATE TRIGGER '.$db->quoteTableName($trigger).' BEFORE UPDATE ON content FOR EACH ROW BEGIN IF NEW.id='.(int)$row['content_id']." AND NEW.state=1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic publication failure'; END IF; END")->execute();echo "{\"installed\":true}\n";break;
 case 'fail-publication-off':
  $db->createCommand('DROP TRIGGER IF EXISTS '.$db->quoteTableName($trigger))->execute();echo "{\"removed\":true}\n";break;
 case 'soft-delete':
  $app->user->switchIdentity(humhub\modules\user\models\User::findOne($f['accounts']['author']['id']));
  $post=humhub\modules\post\models\Post::findOne($row['post_id']);
  echo json_encode(['deleted'=>$post->content->getStateService()->delete()]),"\n";break;
 case 'tamper-message':
  if($row['status']!=='pending')throw new RuntimeException('Pending fixture required.');
  $db->createCommand()->update('post',['message'=>'Synthetic admin-side version tamper; not genuine scholarship.'],['id'=>$row['post_id']])->execute();echo "{\"tampered\":true}\n";break;
 case 'review-grant-off':case 'review-grant-on':
  $db->createCommand()->update('ummah_review_grant',['can_review'=>$op==='review-grant-on'?1:0],['user_id'=>$f['accounts']['reviewer']['id'],'space_id'=>$f['spaceId']])->execute();echo "{\"changed\":true}\n";break;
 case 'audit-update-attempt':
  $entry=$db->createCommand('SELECT id FROM ummah_review_event WHERE review_id=:id ORDER BY id LIMIT 1',[':id'=>$id])->queryScalar();
  if(!$entry)throw new RuntimeException('Fixture audit required.');
  try{$db->createCommand()->update('ummah_review_event',['outcome'=>'tampered'],['id'=>$entry])->execute();echo "{\"denied\":false}\n";}catch(\yii\db\Exception){echo "{\"denied\":true}\n";}break;
 default:throw new RuntimeException('Unsupported fixture probe.');
}
