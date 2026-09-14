const mongoose = require('mongoose');

async function diagnose() {
  await mongoose.connect('mongodb://127.0.0.1:27017/stockora');
  console.log('=== TARGET USERS LOOKUP ===');
  const targetIds = [
    '6a9f284f562dbbe76d1a82a3',
    '6a9f23e5562dbbe76d1a80d0',
    '6a9ea51eee74af7e99fbf26d'
  ];
  for (const tid of targetIds) {
    const u = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(tid) });
    console.log(`User ${tid}:`, u ? { email: u.email, username: u.username } : 'NOT FOUND IN USERS COLLECTION');
  }

  console.log('=== SEARCHING AUDIT LOGS FOR TARGET IDS ===');
  for (const tid of targetIds) {
    const a = await mongoose.connection.collection('auditlogs').find({ targetId: tid }).toArray();
    console.log(`Audits for ${tid}:`, a.map(x => ({ action: x.action, newValues: x.newValues, createdAt: x.createdAt })));
  }

  console.log('=== SEARCHING VERIFICATIONS ===');
  const vList = await mongoose.connection.collection('verifications').find({}).toArray();
  console.log('Verifications:', vList.map(v => ({ email: v.email, userId: v.userId, purpose: v.purpose })));

  await mongoose.disconnect();
}

diagnose().catch(err => {
  console.error(err);
  process.exit(1);
});
