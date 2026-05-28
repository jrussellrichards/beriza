'use strict';
const{S3Client,PutObjectCommand}=require('@aws-sdk/client-s3');
const path=require('path');
const s3=new S3Client({region:process.env.S3_REGION||'us-east-1',...(process.env.S3_ENDPOINT?{endpoint:process.env.S3_ENDPOINT,forcePathStyle:true}:{}),credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID||'',secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY||''}});
async function upload(file,prefix){
  const ext=path.extname(file.originalname).toLowerCase();
  const key=`${prefix}/${Date.now()}${ext}`;
  await s3.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET||'berisa-documents',Key:key,Body:file.buffer,ContentType:file.mimetype}));
  return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
}
module.exports={upload};
