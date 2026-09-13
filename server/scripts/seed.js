import { initDatabase } from '../config/database.js';
import bcrypt from 'bcryptjs';
import { IS_PRODUCTION } from '../config/security.js';
import { assertNoLiveDefaultDemoAdminInProduction } from '../config/demoAdminProtection.js';

const DEMO_ADMIN_EMAIL = 'admin@ecoguard.com';
const DEMO_ADMIN_PASSWORD = 'admin123';
const DEMO_USER_EMAIL = 'user@ecoguard.com';
const DEMO_USER_PASSWORD = 'user123';

async function seed() {
  console.log('🌱 Seeding database...');

  // Security gate: the predictable demo admin account must never be created in
  // production. Production should seed its own admin accounts through a secure,
  // audited process (e.g. a one-off admin invite or an operator script that
  // reads a real secret from a vault, never from logs or CI output).
  if (IS_PRODUCTION) {
    console.error('❌ Seeding is disabled in production.');
    console.error(
      'Production deployments must not run the demo seed script. ' +
      `Use a secure, auditable process to provision the first admin account ` +
      'instead of relying on a predictable demo credential.'
    );
    process.exit(1);
  }



  // TODO: once every other seed step also depends on the demo accounts or demo
  // data, mirror this production guard at the top of the remaining steps too,
  // or move the existing guard up to cover the full script.

  const db = await initDatabase();

  // Hygiene guard: if someone somehow forces the seed script to run against a
  // production database, do not finish seeding and then leave the default demo
  // admin account usable. This is a defense-in-depth check, not the primary
  // control — the main production gate is the startup assertion in
  // server/config/demoAdminProtection.js.
  try {
    await assertNoLiveDefaultDemoAdminInProduction();
  } catch (err) {
    console.error('❌ Seed aborted:', err.message);
    process.exit(1);
  }

  // Create admin user
  const adminPassword = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  await db.run(
    'INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
    [1, 'Admin User', DEMO_ADMIN_EMAIL, adminPassword, 'admin']
  );

  // Create demo user
  const userPassword = await bcrypt.hash(DEMO_USER_PASSWORD, 10);
  await db.run(
    'INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
    [2, 'Demo User', DEMO_USER_EMAIL, userPassword, 'user']
  );

  console.log('✓ Users created');

  // Seed Hazards
  const hazards = [
    {
      name: 'Air Pollution',
      category: 'Air Pollution',
      description: 'Contamination of the air by harmful substances including particulate matter, toxic gases, and chemicals.',
      severity: 'High',
      causes: JSON.stringify(['Vehicle emissions', 'Industrial activities', 'Burning fossil fuels', 'Agricultural waste burning', 'Construction dust']),
      effects: JSON.stringify(['Respiratory diseases', 'Climate change', 'Reduced visibility', 'Acid rain', 'Ecosystem damage']),
      prevention: JSON.stringify(['Use public transport', 'Plant more trees', 'Reduce industrial emissions', 'Use clean energy', 'Avoid burning waste'])
    },
    {
      name: 'Water Pollution',
      category: 'Water Pollution',
      description: 'Contamination of water bodies such as rivers, lakes, and oceans by pollutants.',
      severity: 'Critical',
      causes: JSON.stringify(['Industrial waste', 'Agricultural runoff', 'Sewage discharge', 'Oil spills', 'Plastic waste']),
      effects: JSON.stringify(['Unsafe drinking water', 'Marine life death', 'Ecosystem disruption', 'Disease spread', 'Food chain contamination']),
      prevention: JSON.stringify(['Proper waste disposal', 'Treat industrial effluents', 'Reduce plastic use', 'Protect wetlands', 'Regular water testing'])
    },
    {
      name: 'Soil Pollution',
      category: 'Soil Pollution',
      description: 'Degradation of soil quality due to the presence of toxic chemicals and waste materials.',
      severity: 'High',
      causes: JSON.stringify(['Chemical fertilizers', 'Pesticides', 'Industrial waste', 'Mining activities', 'Improper waste disposal']),
      effects: JSON.stringify(['Reduced soil fertility', 'Food contamination', 'Groundwater pollution', 'Loss of biodiversity', 'Health hazards']),
      prevention: JSON.stringify(['Organic farming', 'Proper waste management', 'Reduce chemical use', 'Soil testing', 'Composting'])
    },
    {
      name: 'Noise Pollution',
      category: 'Noise Pollution',
      description: 'Excessive or harmful levels of noise that disrupt normal activities.',
      severity: 'Moderate',
      causes: JSON.stringify(['Traffic noise', 'Construction activities', 'Industrial machinery', 'Loudspeakers', 'Aircraft noise']),
      effects: JSON.stringify(['Hearing loss', 'Sleep disturbance', 'Stress and anxiety', 'Communication interference', 'Wildlife disruption']),
      prevention: JSON.stringify(['Use sound barriers', 'Limit horn usage', 'Regulate construction hours', 'Urban planning', 'Use quieter equipment'])
    },
    {
      name: 'Plastic Pollution',
      category: 'Plastic Pollution',
      description: 'Accumulation of plastic products in the environment that harm wildlife and ecosystems.',
      severity: 'Critical',
      causes: JSON.stringify(['Single-use plastics', 'Poor waste management', 'Improper disposal', 'Lack of recycling', 'Consumer habits']),
      effects: JSON.stringify(['Ocean contamination', 'Wildlife ingestion', 'Microplastic spread', 'Soil degradation', 'Food chain entry']),
      prevention: JSON.stringify(['Reduce plastic use', 'Recycle properly', 'Use alternatives', 'Support plastic bans', 'Beach cleanups'])
    },
    {
      name: 'Deforestation',
      category: 'Deforestation',
      description: 'The large-scale removal of forest cover leading to habitat loss and climate impact.',
      severity: 'Critical',
      causes: JSON.stringify(['Agricultural expansion', 'Logging', 'Urbanization', 'Mining', 'Forest fires']),
      effects: JSON.stringify(['Loss of biodiversity', 'Climate change', 'Soil erosion', 'Disrupted water cycles', 'Indigenous displacement']),
      prevention: JSON.stringify(['Reforestation programs', 'Sustainable forestry', 'Protect reserves', 'Reduce paper use', 'Support conservation'])
    },
    {
      name: 'Flooding',
      category: 'Flooding',
      description: 'Overflow of water onto normally dry land, often caused by heavy rainfall or poor drainage.',
      severity: 'High',
      causes: JSON.stringify(['Heavy rainfall', 'Poor drainage', 'Deforestation', 'Urban development', 'Climate change']),
      effects: JSON.stringify(['Property damage', 'Loss of life', 'Disease spread', 'Economic loss', 'Displacement']),
      prevention: JSON.stringify(['Build flood barriers', 'Improve drainage', 'Preserve wetlands', 'Early warning systems', 'Avoid floodplains'])
    },
    {
      name: 'Extreme Heat',
      category: 'Extreme Heat',
      description: 'Prolonged periods of excessively hot weather that can be dangerous to health.',
      severity: 'High',
      causes: JSON.stringify(['Climate change', 'Urban heat islands', 'Deforestation', 'Greenhouse gas emissions', 'Global warming']),
      effects: JSON.stringify(['Heat stroke', 'Dehydration', 'Crop failure', 'Wildfires', 'Infrastructure damage']),
      prevention: JSON.stringify(['Plant trees', 'Reduce emissions', 'Stay hydrated', 'Use cooling centers', 'Early warnings'])
    },
    {
      name: 'Wildfires',
      category: 'Wildfires',
      description: 'Uncontrolled fires in natural areas that burn vegetation and threaten communities.',
      severity: 'Critical',
      causes: JSON.stringify(['Dry weather', 'Human negligence', 'Lightning', 'Arson', 'Climate change']),
      effects: JSON.stringify(['Habitat destruction', 'Air pollution', 'Loss of life', 'Property damage', 'Ecosystem disruption']),
      prevention: JSON.stringify(['Fire management', 'Controlled burns', 'Fire breaks', 'Public awareness', 'Early detection'])
    },
    {
      name: 'Chemical Pollution',
      category: 'Chemical Pollution',
      description: 'Release of harmful chemicals into the environment from industrial and agricultural sources.',
      severity: 'Critical',
      causes: JSON.stringify(['Industrial discharge', 'Agricultural chemicals', 'Mining', 'Improper disposal', 'Accidents']),
      effects: JSON.stringify(['Health problems', 'Water contamination', 'Soil toxicity', 'Wildlife poisoning', 'Long-term damage']),
      prevention: JSON.stringify(['Regulate industries', 'Safe disposal', 'Reduce chemical use', 'Monitor pollution', 'Emergency response'])
    }
  ];

  for (const hazard of hazards) {
    await db.run(
      'INSERT OR IGNORE INTO hazards (name, category, description, severity, causes, effects, prevention) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [hazard.name, hazard.category, hazard.description, hazard.severity, hazard.causes, hazard.effects, hazard.prevention]
    );
  }

  console.log('✓ Hazards seeded');

  // Seed Educational Resources
  const resources = [
    {
      title: 'Understanding Air Quality Index',
      category: 'Pollution',
      content: 'The Air Quality Index (AQI) is a standardized indicator of air quality. It tells you how clean or polluted your air is, and what associated health effects might be a concern. The AQI focuses on health effects you may experience within a few hours or days after breathing polluted air. EPA calculates the AQI for five major air pollutants: ground-level ozone, particle pollution, carbon monoxide, sulfur dioxide, and nitrogen dioxide.',
      author: 'EcoGuard Team'
    },
    {
      title: 'Climate Change Basics',
      category: 'Climate',
      content: 'Climate change refers to long-term shifts in temperatures and weather patterns. These shifts may be natural, but since the 1800s, human activities have been the main driver of climate change, primarily due to the burning of fossil fuels which produces heat-trapping gases. The effects include rising temperatures, changing precipitation patterns, melting ice caps, and more extreme weather events.',
      author: 'EcoGuard Team'
    },
    {
      title: 'Effective Waste Management',
      category: 'Waste Management',
      content: 'Proper waste management involves the collection, transport, processing, recycling, and disposal of waste materials. The waste hierarchy ranks waste management strategies according to their environmental impact: prevention, reuse, recycling, recovery, and disposal. By following the 3Rs - Reduce, Reuse, Recycle - we can significantly minimize our environmental footprint.',
      author: 'EcoGuard Team'
    },
    {
      title: 'Protecting Biodiversity',
      category: 'Biodiversity',
      content: 'Biodiversity is the variety of life on Earth, including all plants, animals, and microorganisms, the genes they contain, and the ecosystems they form. It is essential for ecosystem stability and human well-being. Threats to biodiversity include habitat loss, climate change, pollution, and overexploitation. Conservation efforts include protecting habitats, restoring ecosystems, and sustainable resource management.',
      author: 'EcoGuard Team'
    },
    {
      title: 'Water Conservation Techniques',
      category: 'Water Conservation',
      content: 'Water conservation involves using water efficiently and reducing unnecessary water usage. Simple techniques include fixing leaks, using water-efficient fixtures, collecting rainwater, and practicing smart irrigation. In homes, the biggest water users are toilets, washing machines, and showers. By making small changes in daily habits, we can significantly reduce water consumption and protect this precious resource.',
      author: 'EcoGuard Team'
    }
  ];

  // educational_resources has no UNIQUE column, so a bare INSERT OR IGNORE is
  // not idempotent — re-running the seed would stack duplicates. Skip rows that
  // are already present (by exact title) instead.
  for (const resource of resources) {
    const existing = await db.get(
      'SELECT id FROM educational_resources WHERE title = ?',
      [resource.title]
    );
    if (existing) continue;
    await db.run(
      'INSERT INTO educational_resources (title, category, content, author) VALUES (?, ?, ?, ?)',
      [resource.title, resource.category, resource.content, resource.author]
    );
  }

  console.log('✓ Educational resources seeded');

  // Seed Quiz
  await db.run(
    'INSERT OR IGNORE INTO quizzes (id, title, description) VALUES (?, ?, ?)',
    [1, 'Environmental Awareness Quiz', 'Test your knowledge about environmental hazards and conservation']
  );

  const questions = [
    {
      question: 'What is the primary cause of air pollution in urban areas?',
      options: JSON.stringify(['Vehicle emissions', 'Natural disasters', 'Ocean currents', 'Solar radiation']),
      correct_answer: 'Vehicle emissions'
    },
    {
      question: 'Which of the following is NOT a renewable energy source?',
      options: JSON.stringify(['Solar power', 'Wind energy', 'Coal', 'Hydropower']),
      correct_answer: 'Coal'
    },
    {
      question: 'What does the 3Rs principle stand for?',
      options: JSON.stringify(['Reduce, Reuse, Recycle', 'Remove, Replace, Restore', 'Read, Research, Report', 'Run, Rest, Repeat']),
      correct_answer: 'Reduce, Reuse, Recycle'
    },
    {
      question: 'Which greenhouse gas is most abundant in the atmosphere?',
      options: JSON.stringify(['Carbon dioxide', 'Methane', 'Nitrous oxide', 'Water vapor']),
      correct_answer: 'Water vapor'
    },
    {
      question: 'What is the main cause of deforestation?',
      options: JSON.stringify(['Agricultural expansion', 'Natural forest fires', 'Disease', 'Volcanic eruptions']),
      correct_answer: 'Agricultural expansion'
    }
  ];

  // Same idempotency note as educational_resources: questions has no UNIQUE
  // constraint, so check by (quiz_id, question text) before inserting.
  for (const q of questions) {
    const existing = await db.get(
      'SELECT id FROM questions WHERE quiz_id = 1 AND question = ?',
      [q.question]
    );
    if (existing) continue;
    await db.run(
      'INSERT INTO questions (quiz_id, question, options, correct_answer) VALUES (?, ?, ?, ?)',
      [1, q.question, q.options, q.correct_answer]
    );
  }

  console.log('✓ Quiz seeded');

  // Seed demo reports (community signals across the demo region)
  const demoReports = [
    {
      id: 'ECO-2026-00001',
      user_id: 2,
      hazard_type: 'Air Pollution',
      title: 'Heavy smog in downtown area',
      description: 'Thick smog visible throughout the day, affecting visibility and causing breathing difficulties.',
      location: 'Downtown Business District',
      latitude: 40.7128,
      longitude: -74.006,
      severity: 'High',
      status: 'Under Review'
    },
    {
      id: 'ECO-2026-00002',
      user_id: 2,
      hazard_type: 'Water Pollution',
      title: 'Industrial waste in river',
      description: 'Noticed unusual discoloration and chemical smell in the river water near the industrial zone.',
      location: 'East River Industrial Zone',
      latitude: 40.7282,
      longitude: -73.9942,
      severity: 'Critical',
      status: 'Verified'
    },
    {
      id: 'ECO-2026-00003',
      user_id: 2,
      hazard_type: 'Plastic Pollution',
      title: 'Beach littered with plastic waste',
      description: 'Large amounts of plastic bottles, bags, and other debris washed up on the shore.',
      location: 'Sandy Beach Park',
      latitude: 40.5853,
      longitude: -73.8183,
      severity: 'Moderate',
      status: 'Resolved'
    },
    {
      id: 'ECO-2026-00004',
      user_id: 2,
      hazard_type: 'Deforestation',
      title: 'Trees cleared along the north woodline',
      description: 'A strip of mature oaks was cleared overnight near the park boundary; stumps and fresh tire tracks remain.',
      location: 'Van Cortlandt Park, North Woodline',
      latitude: 40.8979,
      longitude: -73.8866,
      severity: 'Critical',
      status: 'Under Review'
    },
    {
      id: 'ECO-2026-00005',
      user_id: 2,
      hazard_type: 'Extreme Heat',
      title: 'Street thermometer reading 104°F',
      description: 'Asphalt radiating heat after three consecutive days above 95°F; no cooling center within a 15-minute walk.',
      location: 'East Harlem, 3rd Ave',
      latitude: 40.7956,
      longitude: -73.9439,
      severity: 'High',
      status: 'Verified'
    },
    {
      id: 'ECO-2026-00006',
      user_id: 2,
      hazard_type: 'Flooding',
      title: 'Street flooding after storm surge',
      description: 'Water pooling above the curb line at the canal bend; several basement entrances already underwater.',
      location: 'Gowanus Canal Bend',
      latitude: 40.6782,
      longitude: -73.9907,
      severity: 'Critical',
      status: 'Pending'
    },
    {
      id: 'ECO-2026-00007',
      user_id: 2,
      hazard_type: 'Soil Pollution',
      title: 'Oily sheen on vacant lot soil',
      description: 'Discoloured, petroleum-smelling soil where an old garage stood; children play on the lot after school.',
      location: 'Jersey City, Monticello Ave',
      latitude: 40.7282,
      longitude: -74.0776,
      severity: 'Moderate',
      status: 'Submitted'
    },
    {
      id: 'ECO-2026-00008',
      user_id: 2,
      hazard_type: 'Noise Pollution',
      title: 'Night construction noise near homes',
      description: 'Jackhammering past midnight for three nights running; residents report broken sleep.',
      location: 'Jackson Heights, 37th Ave',
      latitude: 40.7506,
      longitude: -73.8833,
      severity: 'Moderate',
      status: 'Resolved'
    },
    {
      id: 'ECO-2026-00009',
      user_id: 2,
      hazard_type: 'Chemical Pollution',
      title: 'Chemical spill runoff at depot',
      description: 'Blue-tinted runoff from the transport depot heading into the storm drain; strong solvent odour.',
      location: 'Bushwick, Flushing Ave Depot',
      latitude: 40.6941,
      longitude: -73.924,
      severity: 'Critical',
      status: 'Verified'
    },
    {
      id: 'ECO-2026-00010',
      user_id: 2,
      hazard_type: 'Air Pollution',
      title: 'Haze along the ferry terminal',
      description: 'Diesel haze lingering at the terminal all morning; several commuters coughing on the platform.',
      location: 'Staten Island Ferry Terminal',
      latitude: 40.6437,
      longitude: -74.0733,
      severity: 'High',
      status: 'Pending'
    }
  ];

  for (const report of demoReports) {
    await db.run(
      `INSERT OR IGNORE INTO hazard_reports
      (id, user_id, hazard_type, title, description, location, latitude, longitude, severity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [report.id, report.user_id, report.hazard_type, report.title, report.description,
       report.location, report.latitude, report.longitude, report.severity, report.status]
    );
  }

  console.log('✓ Demo reports seeded');
  // Do not print demo credentials in plain text. Even in development, avoid
  // emitting a reusable, predictable credential pair in logs/CI output. Instead,
  // remind operators where to find the documented demo credentials.
  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Demo credentials are documented in server/.env.example and the project README.');

  await db.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
