const mongoose = require('mongoose');

async function searchAllDbs() {
  const adminConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/admin').asPromise();
  const dbs = await adminConn.db.admin().listDatabases();
  console.log('Databases:', dbs.databases.map(d => d.name));

  for (const dbInfo of dbs.databases) {
    const dbName = dbInfo.name;
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/' + dbName).asPromise();
    const cols = await conn.db.listCollections().toArray();
    for (const col of cols) {
      try {
        const found = await conn.collection(col.name).find({
          $or: [
            { email: /trustezika/i },
            { username: /trustezika/i },
            { contactEmail: /trustezika/i },
            { 'contact.email': /trustezika/i }
          ]
        }).toArray();
        if (found.length > 0) {
          console.log(`FOUND in DB "${dbName}", Collection "${col.name}":`, found.length, 'docs');
          found.forEach(doc => {
            console.log({
              _id: doc._id,
              email: doc.email,
              username: doc.username,
              hasPassword: !!doc.password,
              passwordPrefix: doc.password ? doc.password.substring(0, 10) : null,
              roleName: doc.roleName,
              createdAt: doc.createdAt
            });
          });
        }
      } catch (e) {}
    }
    await conn.close();
  }
  await adminConn.close();
}

searchAllDbs().catch(console.error);
