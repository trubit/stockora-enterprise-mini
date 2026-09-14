const mongoose = require('mongoose');

async function searchEmails() {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/stockora').asPromise();
  const cols = await conn.db.listCollections().toArray();
  console.log('=== ALL EMAILS IN STOCKORA DATABASE ===');
  for (const col of cols) {
    try {
      const docsWithEmail = await conn.collection(col.name).find({ email: { $exists: true, $ne: null } }).toArray();
      if (docsWithEmail.length > 0) {
        const emails = [...new Set(docsWithEmail.map(d => d.email))];
        console.log(`Collection "${col.name}" has ${docsWithEmail.length} docs with emails:`, emails);
      }
    } catch (e) {}
  }
  await conn.close();

  console.log('=== USERS IN STOCKORA ===');
  const uConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/stockora').asPromise();
  const users = await uConn.collection('users').find({}).toArray();
  console.log(users.map(u => ({ id: u._id, email: u.email, username: u.username })));
  await uConn.close();
}

searchEmails().catch(console.error);
