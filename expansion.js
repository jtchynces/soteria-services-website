const expansionSeo = {
  '/remote-medical-services': ['Remote & Industrial Medical Services | Soteria Services', 'Explore remote medical coverage, rotational staffing inquiries and response planning for industrial and northern sites.'],
  '/emergency-management': ['Emergency Management Consulting Ontario | Soteria Services', 'Emergency response planning, preparedness assessments, exercises and incident management support for organizations and communities.'],
  '/health-safety': ['Workplace Health & Safety Training | Soteria Services', 'Workplace safety training and consultation inquiries, including WHMIS, PPE and emergency preparedness.'],
  '/corporate-training': ['Corporate First Aid Training | Soteria Services', 'Request workplace first aid and CPR training for your organization.'],
  '/medical-coverage-request': ['Request Medical Coverage | Soteria Services', 'Request event or remote medical coverage for your organization.'],
  '/about': ['About Soteria Services | Established 2017', 'Learn about Soteria Services, a Canadian safety and emergency preparedness company established in 2017.'],
  '/shop-equipment': ['Shop AEDs and First Aid Equipment | Soteria Services', 'Browse available AEDs, first aid equipment and workplace safety products.'],
  '/courses': ['First Aid and Workplace Safety Training | Soteria Services', 'Explore first aid, CPR and workplace safety training inquiries for your organization.']
};

function expansionPage(title, summary, sections, cta, href) {
  return hero(esc(title), esc(summary), 'Contact Us') + '<section class="section"><div class="grid two">' + sections.map(section => '<article><h2>' + esc(section[0]) + '</h2><p>' + esc(section[1]) + '</p></article>').join('') + '</div><div class="actions"><a class="btn" href="' + href + '" data-link>' + esc(cta) + '</a></div></section>';
}

function businessInquiry(kind) {
  const medical = kind === 'medical';
  const fields = medical
    ? [['project','Project or event name'],['location','Location'],['dates','Dates'],['participants','Number of participants or workers'],['operations','Nature of operations and medical risks'],['hours','Coverage hours and staffing requirements'],['infrastructure','Existing medical infrastructure and evacuation arrangements']]
    : [['location','Training location'],['course','Requested course'],['participants','Number of participants'],['dates','Preferred dates'],['renewal','Certification renewal deadlines'],['requirements','Additional training requirements']];
  return hero(medical?'Request Medical Coverage':'Corporate Training Inquiry', medical?'Tell us about your event or worksite.':'Plan workplace training for your team.', 'Contact Us') + '<section class="section"><form id="business-inquiry" class="card" data-kind="'+kind+'"><div class="form-grid"><div class="field"><label for="business-name">Contact name</label><input id="business-name" name="name" required></div><div class="field"><label for="business-org">Organization</label><input id="business-org" name="organization" required></div><div class="field"><label for="business-email">Email</label><input id="business-email" type="email" name="email" required></div><div class="field"><label for="business-phone">Phone</label><input id="business-phone" type="tel" name="phone" required></div>' + fields.map(([name,label])=>'<div class="field"><label for="business-'+name+'">'+label+'</label><input id="business-'+name+'" name="'+name+'"></div>').join('') + '</div><div class="actions"><button class="btn" type="submit">Submit Inquiry</button></div><div id="business-inquiry-message" role="status"></div></form></section>';
}

function shopEquipment() {
  const inventory = products().filter(p => !/training|course|pulse|event|consulting|assessment|mask fit/i.test(p.category || ''));
  const categories = [...new Set(inventory.map(p => p.category).filter(Boolean))].sort();
  return hero('Shop Equipment', 'Explore available AEDs, supplies and safety equipment.', 'Contact Us') + '<section class="section"><div class="form-grid"><div class="field"><label for="shop-search">Search products</label><input id="shop-search" type="search" placeholder="Search equipment"></div><div class="field"><label for="shop-category">Category</label><select id="shop-category"><option value="">All categories</option>' + categories.map(category => '<option value="'+esc(category)+'">'+esc(category)+'</option>').join('') + '</select></div></div><div id="shop-results" class="grid three" style="margin-top:24px">' + (inventory.length ? inventory.map(productCard).join('') : '<p>Contact us for current product availability and a quote.</p>') + '</div></section>';
}

function trainingCatalog() {
  const courses = products().filter(p => /training|course/i.test(p.category || ''));
  return expansionPage('Training & Courses', 'First aid, CPR and workplace training for individuals and organizations.', [
    ['First aid and CPR', 'Ask about emergency first aid, standard first aid, CPR/AED and basic life support options.'],
    ['Corporate training', 'Discuss group bookings and training at your workplace where appropriate.'],
    ['Workplace safety', 'Ask about available online and in-person safety courses. Course availability, certification and provider details are confirmed before booking.']
  ], 'Request Corporate Training', '/corporate-training') + '<section class="section"><h2>Available Training</h2><div class="grid three">' + (courses.length ? courses.map(productCard).join('') : '<p>Contact us for current courses and dates.</p>') + '</div></section>';
}

const expansionRoutes = {
  '/shop-equipment': shopEquipment,
  '/courses': trainingCatalog,
  '/remote-medical-services': () => expansionPage('Event & Remote Medical Services', 'Medical coverage inquiries for events, industrial operations and remote worksites.', [
    ['Event coverage', 'Coverage can be discussed for festivals, sporting events, concerts, community gatherings and corporate events.'],
    ['Industrial and remote worksites', 'Discuss on-site coverage, rotational medical staffing and equipment planning for construction, mining and northern operations.'],
    ['Planning and response', 'Inquiries may include response planning, trauma training, medical infrastructure and evacuation coordination.'],
    ['Service arrangements', 'Services depend on qualified personnel, scope of practice, licensing, operational capacity and contractual arrangements.']
  ], 'Request Medical Coverage', '/medical-coverage-request'),
  '/emergency-management': () => expansionPage('Emergency Management', 'Practical preparedness and response planning for organizations and communities.', [
    ['Planning and assessment', 'Discuss emergency plans, hazard and risk assessments, business continuity and preparedness program development.'],
    ['Exercises and improvement', 'Explore tabletop and functional exercises, after-action reviews and improvement planning.'],
    ['Emergency operations', 'Discuss incident management procedures and emergency operations centre development.'],
    ['IMS and EMO training', 'Interest in future training is welcome. Official course delivery is subject to the required authorization and permissions.']
  ], 'Request a Consultation', '/request-quote?service=Readiness+Assessment'),
  '/health-safety': () => expansionPage('Occupational Health & Safety', 'Workplace safety training and preparedness support tailored to your organization.', [
    ['Workplace training inquiries', 'Ask about WHMIS, transportation of dangerous goods, PPE, fire safety, lockout/tagout and confined space awareness.'],
    ['Training needs', 'Discuss training needs assessments, workplace emergency procedures and practical safety program support.'],
    ['Equipment and readiness', 'Explore AED program development, first aid supplies and compliance support.'],
    ['Training scope', 'Awareness courses are distinct from regulated certifications. Availability and qualifications are confirmed before booking.']
  ], 'Request a Safety Consultation', '/request-quote?service=Other'),
  '/corporate-training': () => businessInquiry('training'),
  '/medical-coverage-request': () => businessInquiry('medical'),
  '/about': () => expansionPage('About Soteria Services', 'Established in 2017. Prepared Today. Protected Tomorrow.', [
    ['A Canadian safety company', 'Soteria Services helps organizations protect their people, prepare for emergencies and create safer workplaces.'],
    ['Practical and client-focused', 'Our work brings together training, emergency preparedness, safety equipment and response experience to support organizations and communities.'],
    ['A growing service offering', 'Soteria continues to expand into medical services and emergency management to support evolving client needs.']
  ], 'Contact Soteria', '/contact')
};

document.addEventListener('input', event => {
  if (!['shop-search', 'shop-category'].includes(event.target.id)) return;
  const query = document.getElementById('shop-search').value.trim().toLowerCase();
  const category = document.getElementById('shop-category').value;
  const matches = products().filter(p => !/training|course|pulse|event|consulting|assessment|mask fit/i.test(p.category || '') && (!category || p.category === category) && [p.name, p.description, p.category].some(value => String(value || '').toLowerCase().includes(query)));
  document.getElementById('shop-results').innerHTML = matches.length ? matches.map(productCard).join('') : '<p>No matching products. Contact us for assistance.</p>';
});
document.addEventListener('change', event => {
  if (event.target.id === 'shop-category') event.target.dispatchEvent(new Event('input', { bubbles: true }));
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'business-inquiry') return;
  event.preventDefault();
  const form = event.target, data = Object.fromEntries(new FormData(form)), button = form.querySelector('button[type="submit"]');
  const medical = form.dataset.kind === 'medical';
  const message = Object.entries(data).filter(([key, value]) => !['name','organization','email','phone'].includes(key) && value).map(([key, value]) => key + ': ' + value).join('\n');
  button.disabled = true;
  try {
    const response = await fetch('/api/quote-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, serviceInterest: medical ? 'Event Medical' : 'First Aid Training', message }) });
    const result = await jsonResponse(response);
    if (!response.ok) throw new Error(result.error || 'Your inquiry could not be submitted.');
    setMessage('business-inquiry-message', '<p class="notice">Your inquiry was received. Soteria Services will follow up.</p>');
    form.reset();
  } catch (error) {
    setMessage('business-inquiry-message', '<p class="notice" role="alert">' + esc(error.message) + '</p>');
  } finally { button.disabled = false; }
});
