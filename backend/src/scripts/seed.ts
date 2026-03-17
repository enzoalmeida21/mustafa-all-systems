import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { UserRole } from '../types';

async function main() {
  console.log('🌱 Seeding database...');

  // Create test users
  const adminPassword = await hashPassword('admin123');
  const supervisorPassword = await hashPassword('senha123');
  const promoterPassword = await hashPassword('senha123');

  // Create admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@promo.com' },
    update: {},
    create: {
      email: 'admin@promo.com',
      name: 'Administrador',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  console.log('✅ Admin created:', admin.email);

  // Create supervisor
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@teste.com' },
    update: {},
    create: {
      email: 'supervisor@teste.com',
      name: 'Supervisor Teste',
      password: supervisorPassword,
      role: UserRole.SUPERVISOR,
    },
  });

  console.log('✅ Supervisor created:', supervisor.email);

  // Create promoters
  const promoters = await Promise.all([
    prisma.user.upsert({
      where: { email: 'promotor1@teste.com' },
      update: {},
      create: {
        email: 'promotor1@teste.com',
        name: 'Promotor 1',
        password: promoterPassword,
        role: UserRole.PROMOTER,
      },
    }),
    prisma.user.upsert({
      where: { email: 'promotor2@teste.com' },
      update: {},
      create: {
        email: 'promotor2@teste.com',
        name: 'Promotor 2',
        password: promoterPassword,
        role: UserRole.PROMOTER,
      },
    }),
  ]);

  console.log('✅ Promoters created:', promoters.map(p => p.email));

  // Create test stores (check if they exist first)
  let store1 = await prisma.store.findFirst({
    where: { name: 'Loja ABC' },
  });

  if (!store1) {
    store1 = await prisma.store.create({
      data: {
        name: 'Loja ABC',
        address: 'Rua Teste, 123 - São Paulo, SP',
        latitude: -23.5505,
        longitude: -46.6333,
      },
    });
  }

  let store2 = await prisma.store.findFirst({
    where: { name: 'Loja XYZ' },
  });

  if (!store2) {
    store2 = await prisma.store.create({
      data: {
        name: 'Loja XYZ',
        address: 'Av. Exemplo, 456 - São Paulo, SP',
        latitude: -23.5632,
        longitude: -46.6541,
      },
    });
  }

  const stores = [store1, store2];

  console.log('✅ Stores created:', stores.map(s => s.name));

  // 11 indústrias (code + abbreviation) – upsert por code
  const industriesData = [
    { code: '55673', name: 'ROSATEX DO DORDESTE PROD SANEANTES LTDA', abbreviation: 'ROS' },
    { code: '266', name: 'DOBRASIL IND DE ARTEFATOS DE PLAST LTDA', abbreviation: 'DOB' },
    { code: '5963', name: 'ALUKENT EMBALAGENS LTDA', abbreviation: 'ALU' },
    { code: '76', name: 'VINICOLA SALTON S A', abbreviation: 'SAL' },
    { code: '6886', name: 'INDUSTRIA E COMERCIO DE BEBIDAS PINHEIRENSE LTDA', abbreviation: 'PIN' },
    { code: '18456', name: 'M L C FERREIRA E CIA LTDA', abbreviation: 'MLC' },
    { code: '1731', name: 'SCHWANKE INDUSTRIA TEXTIL LTDA', abbreviation: 'SCH' },
    { code: '7729', name: 'ISPL IND SULAMERICA PROD DE LIMPEZA LTDA', abbreviation: 'ISPL' },
    { code: '10140', name: 'NEWELL BRANDS BRASIL LTDA', abbreviation: 'NEW' },
    { code: '23240', name: 'INDUSTRIA E COMERCIO OLIVEIRA LTDA', abbreviation: 'OLI' },
    { code: '23241', name: 'BAPTISTA DE ALMEIDA COM IND LTDA', abbreviation: 'BAP' },
  ];

  const industries = await Promise.all(
    industriesData.map(({ code, name, abbreviation }) =>
      prisma.industry.upsert({
        where: { code },
        update: { name, abbreviation },
        create: { code, name, abbreviation, isActive: true },
      })
    )
  );
  console.log('✅ Industries created/updated:', industries.length);

  // Vincular todas as indústrias a todas as lojas (StoreIndustry)
  const allStores = await prisma.store.findMany({ select: { id: true } });
  for (const store of allStores) {
    for (const industry of industries) {
      await prisma.storeIndustry.upsert({
        where: {
          storeId_industryId: { storeId: store.id, industryId: industry.id },
        },
        update: { isActive: true },
        create: {
          storeId: store.id,
          industryId: industry.id,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ StoreIndustry: all industries linked to all stores');

  // Create photo quotas
  await Promise.all(
    promoters.map(promoter =>
      prisma.photoQuota.upsert({
        where: { promoterId: promoter.id },
        update: {},
        create: {
          promoterId: promoter.id,
          expectedPhotos: 10,
        },
      })
    )
  );

  console.log('✅ Photo quotas created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Test credentials:');
  console.log('Admin:');
  console.log('  Email: admin@promo.com');
  console.log('  Password: admin123');
  console.log('\nSupervisor:');
  console.log('  Email: supervisor@teste.com');
  console.log('  Password: senha123');
  console.log('\nPromoters:');
  console.log('  Email: promotor1@teste.com ou promotor2@teste.com');
  console.log('  Password: senha123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

