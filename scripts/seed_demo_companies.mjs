import mongoose from 'mongoose';

async function seedDemoCompanies() {
  console.log('Connecting to database...');
  await mongoose.connect('mongodb://127.0.0.1:27017/stockora');

  const db = mongoose.connection.db;
  const tenantsColl = db.collection('tenants');
  const companiesColl = db.collection('companies');
  const branchesColl = db.collection('branches');
  const usersColl = db.collection('users');

  const demoCompanies = [
    {
      name: 'Harn Security Corp',
      legalName: 'Harn Security Technologies Ltd',
      slug: 'harn-sec',
      status: 'ACTIVE',
      businessType: 'Security Services & Hardware',
      industry: 'Security & Surveillance',
      contact: {
        email: 'owner@harn.com',
        phone: '+1 416-555-0144',
        city: 'Toronto',
        country: 'Canada',
      },
      branding: {
        primaryColor: '#6366f1',
      },
      branchName: 'Harn Toronto Flagship',
      branchCode: 'HARN-TO-01',
    },
    {
      name: 'Hanson Global Holdings',
      legalName: 'Hanson Global Logistics Ltd',
      slug: 'hanson-global',
      status: 'ACTIVE',
      businessType: 'Global Supply & Distribution',
      industry: 'Logistics & Warehousing',
      contact: {
        email: 'owner@hanson.com',
        phone: '+44 20 7946 0912',
        city: 'London',
        country: 'United Kingdom',
      },
      branding: {
        primaryColor: '#10b981',
      },
      branchName: 'Hanson London Central',
      branchCode: 'HAN-LDN-01',
    },
    {
      name: 'Apex Retail Group',
      legalName: 'Apex Supermarkets Nigeria Ltd',
      slug: 'apex-retail',
      status: 'ACTIVE',
      businessType: 'Supermarket & FMCG Retail',
      industry: 'Retail & Grocery',
      contact: {
        email: 'owner@apex.com',
        phone: '+234 803 123 4567',
        city: 'Lagos',
        country: 'Nigeria',
      },
      branding: {
        primaryColor: '#f59e0b',
      },
      branchName: 'Apex Victoria Island Store',
      branchCode: 'APX-VI-01',
    },
  ];

  for (const comp of demoCompanies) {
    let existingTenant = await tenantsColl.findOne({ slug: comp.slug });
    if (!existingTenant) {
      const tenantDoc = {
        name: comp.name,
        legalName: comp.legalName,
        slug: comp.slug,
        status: comp.status,
        businessType: comp.businessType,
        industry: comp.industry,
        branding: comp.branding,
        contact: comp.contact,
        subscriptionTier: 'ENTERPRISE',
        onboardingCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const insertRes = await tenantsColl.insertOne(tenantDoc);
      existingTenant = { ...tenantDoc, _id: insertRes.insertedId };
      console.log(`✅ Created Demo Tenant: "${comp.name}" (Slug: ${comp.slug})`);

      // Create company record
      const compDoc = {
        tenantId: existingTenant._id,
        name: comp.name,
        slug: comp.slug,
        address: `${comp.contact.city}, ${comp.contact.country}`,
        phone: comp.contact.phone,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const compRes = await companiesColl.insertOne(compDoc);

      // Create primary branch
      await branchesColl.insertOne({
        tenantId: existingTenant._id,
        companyId: compRes.insertedId,
        name: comp.branchName,
        code: comp.branchCode,
        isMain: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      console.log(`ℹ️ Tenant "${comp.name}" already exists.`);
    }
  }

  // Update superadmin user with isPlatformAdmin and all tenant memberships
  const allTenants = await tenantsColl.find({ status: 'ACTIVE' }).toArray();
  const superadmin = await usersColl.findOne({ email: 'trustezika831@gmail.com' });

  if (superadmin) {
    const memberships = allTenants.map((t, idx) => ({
      tenantId: t._id,
      tenantSlug: t.slug,
      tenantName: t.name,
      roleName: 'Super Administrator',
      isDefault: idx === 0,
      joinedAt: new Date(),
    }));

    await usersColl.updateOne(
      { _id: superadmin._id },
      {
        $set: {
          isPlatformAdmin: true,
          roleName: 'Super Administrator',
          tenants: memberships,
        },
      }
    );
    console.log(`\n👑 Super Administrator (${superadmin.email}) linked to ${memberships.length} companies:`);
    memberships.forEach(m => console.log(`   - ${m.tenantName} (${m.tenantSlug})`));
  }

  await mongoose.connection.close();
  console.log('\n🎉 Multi-company seeding complete!');
}

seedDemoCompanies().catch(console.error);
