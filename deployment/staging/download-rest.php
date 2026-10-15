<?php
$lock=json_decode(file_get_contents('/tmp/upstream-lock.json'),true,512,JSON_THROW_ON_ERROR)['rest'];
if($lock['version']!=='0.12.4'||$lock['url']!=='https://marketplace.humhub.com/downloads/free/rest-v0.12.4.zip'||!preg_match('/^[a-f0-9]{64}$/D',$lock['sha256']))throw new RuntimeException('Pinned REST lock required.');
$c=curl_init($lock['url']);curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>60,CURLOPT_FAILONERROR=>true]);$data=curl_exec($c);curl_close($c);
if(!is_string($data)||!hash_equals($lock['sha256'],hash('sha256',$data)))throw new RuntimeException('REST artifact checksum mismatch.');
file_put_contents('/tmp/rest.zip',$data);$z=new ZipArchive();if($z->open('/tmp/rest.zip')!==true)throw new RuntimeException('REST zip unavailable.');
for($i=0;$i<$z->numFiles;$i++){$name=$z->getNameIndex($i);if(!str_starts_with($name,'rest/')||str_contains($name,'..')||str_contains($name,'\\'))throw new RuntimeException('Unsafe REST archive path.');}
if(!$z->extractTo('/var/www/html/protected/modules'))throw new RuntimeException('REST extraction failed.');$z->close();unlink('/tmp/rest.zip');
