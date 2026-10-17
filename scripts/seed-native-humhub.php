<?php
/** Local isolated qualification fixture, NEVER existing-account enrollment. */
if (getenv('UMMAH_REVIEW_ENVIRONMENT') !== 'isolated-staging' || getenv('UMMAH_NATIVE_FIXTURE') !== 'sandbox-only') {
    throw new RuntimeException('Explicit isolated native fixture required.');
}
$root = realpath(getenv('HUMHUB_ROOT') ?: '');
$output = getenv('UMMAH_NATIVE_FIXTURE_FILE');
if (!$root || !$output || file_exists($output)) { throw new RuntimeException('New protected fixture output required.'); }
$_SERVER['SCRIPT_FILENAME'] = $root . '/index.php';
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['HTTP_HOST'] = '127.0.0.1:3401';
$_SERVER['REQUEST_URI'] = '/';
define('YII_DEBUG', false); define('YII_ENV', 'prod');
require $root . '/protected/vendor/autoload.php';
require $root . '/protected/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@humhub', $root . '/protected/humhub');
$bootstrap = new humhub\services\BootstrapService();
$config = $bootstrap->getConfig('web');
$config['components']['user']['enableSession'] = false;
$app = new humhub\components\Application($config);
use humhub\modules\user\models\User;
use humhub\modules\user\models\Password;
use humhub\modules\space\models\Space;
use humhub\modules\space\models\Membership;
use humhub\modules\rest\models\RestUserBearerToken;
use humhub\modules\rest\models\ConfigureForm;
$fixture = ['kind'=>'native-humhub-sandbox-fixture','accounts'=>[]];
foreach (['author','reviewer','excluded'] as $role) {
    $user = User::findOne(['username'=>'ummah-' . $role]) ?? new User(['username'=>'ummah-' . $role,'email'=>$role . '@example.invalid','status'=>User::STATUS_ENABLED,'language'=>'']);
    if ($user->email !== $role . '@example.invalid') { throw new RuntimeException('Refuse non-fixture user.'); }
    if (!$user->save()) { throw new RuntimeException('Fixture user rejected: ' . json_encode($user->errors)); }
    $user->profile->firstname = 'Test'; $user->profile->lastname = ucfirst($role); $user->profile->save();
    $password = bin2hex(random_bytes(24));
    $record = Password::findOne(['user_id'=>$user->id]) ?? new Password(); $record->user_id=$user->id; $record->setPassword($password);
    if (!$record->save()) { throw new RuntimeException('Fixture password could not be saved.'); }
    $bearer = RestUserBearerToken::findOne(['user_id'=>$user->id]) ?? new RestUserBearerToken(['user_id'=>$user->id]);
    $bearer->expiration=gmdate('Y-m-d H:i:s',time()+7200);
    if (!$bearer->isNewRecord) { $bearer->newToken=Yii::$app->security->generateRandomString(86); $bearer->token=hash('sha256',$bearer->newToken); }
    if (!$bearer->save(false)) { throw new RuntimeException('Fixture token failed.'); }
    $fixture['accounts'][$role] = ['id'=>(int)$user->id,'username'=>$user->username,'password'=>$password,'token'=>$bearer->newToken];
}
$app->user->switchIdentity(User::findOne($fixture['accounts']['author']['id']));
$space = Space::findOne(['name'=>'UmmahConnect Staging Review']);
if ($space && ((int)$space->visibility !== Space::VISIBILITY_NONE || (int)$space->join_policy !== Space::JOIN_POLICY_NONE
    || (int)$space->auto_add_new_members !== 0 || (int)Membership::find()->where(['space_id'=>$space->id])->count() !== 0)) {
    throw new RuntimeException('Refuse to reuse a nonempty or nonprivate bootstrap fixture space.');
}
$space ??= new Space(['name'=>'Native fixture permitted community','description'=>'Sandbox qualification only; not verified scholarship.','visibility'=>Space::VISIBILITY_NONE]);
// Operator-side fixture creation, not an assertion that members can create spaces.
if ($space->isNewRecord && !$space->save(false)) { throw new RuntimeException('Fixture space failed.'); }
$fixture['spaceId']=(int)$space->id;
foreach (['author','reviewer'] as $role) {
    $uid=$fixture['accounts'][$role]['id'];
    $membership = Membership::findOne(['space_id'=>$space->id,'user_id'=>$uid]);
    if (!$membership && !$space->addMember($uid)) { throw new RuntimeException('Membership failed.'); }
    $app->db->createCommand()->insert('{{%ummah_review_grant}}',['space_id'=>$space->id,'user_id'=>$uid,'can_submit'=>1,'can_review'=>$role==='reviewer'?1:0])->execute();
}
$app->user->switchIdentity(User::findOne($fixture['accounts']['excluded']['id']));
$excludedSpace = new Space(['name'=>'Native fixture excluded community','description'=>'Excluded membership qualification.','visibility'=>Space::VISIBILITY_NONE]);
if (!$excludedSpace->save(false)) { throw new RuntimeException('Excluded community failed.'); }
$fixture['forbiddenSpaceId']=(int)$excludedSpace->id;
$rest = ConfigureForm::getInstance();
$rest->enableBearerAuth=true; $rest->enableBasicAuth=false; $rest->enableJwtAuth=false; $rest->enableQueryParamAuth=false; $rest->enabledForAllUsers=false;
$rest->enabledUsers=[]; $rest->apiModules=['ummahreview']; $rest->saveSettings();
if (!in_array($fixture['spaceId'],humhub\modules\ummahreview\Module::spaceIds(),true)) { throw new RuntimeException('Fixture space not guarded.'); }
$old=umask(0077); file_put_contents($output,json_encode($fixture,JSON_PRETTY_PRINT)); umask($old); chmod($output,0600);
echo json_encode(['fixtureCreated'=>true,'accounts'=>array_map(fn($u)=>['id'=>$u['id']],$fixture['accounts']),'spaceId'=>$fixture['spaceId'],'forbiddenSpaceId'=>$fixture['forbiddenSpaceId']]),"\n";
