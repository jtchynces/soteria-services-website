const expansionSeo = {
  '/medical-services': ['Medical Services Ontario | Soteria Services', 'Request event, industrial and remote medical coverage for organizations and communities.'],
  '/remote-medical-services': ['Remote & Industrial Medical Services | Soteria Services', 'Explore remote medical coverage, rotational staffing inquiries and response planning for industrial and northern sites.'],
  '/emergency-management': ['Emergency Management Consulting Ontario | Soteria Services', 'Emergency response planning, preparedness assessments, exercises and incident management support for organizations and communities.'],
  '/health-safety': ['Workplace Health & Safety Training | Soteria Services', 'Workplace safety training and consultation inquiries, including WHMIS, PPE and emergency preparedness.'],
  '/corporate-training': ['Corporate First Aid Training | Soteria Services', 'Request workplace first aid and CPR training for your organization.'],
  '/medical-coverage-request': ['Request Medical Coverage | Soteria Services', 'Request event or remote medical coverage for your organization.'],
  '/about': ['About Soteria Services | Established 2017', 'Learn about Soteria Services, a Canadian safety and emergency preparedness company established in 2017.'],
  '/shop-equipment': ['Shop AEDs and First Aid Equipment | Soteria Services', 'Browse available AEDs, first aid equipment and workplace safety products.'],
  '/soteria-ready': ['Soteria Ready | Preparedness Service Packages', 'Request a tailored Soteria Ready equipment inspection and preparedness service quote.'],
  '/online-courses': ['Online Courses | Soteria Services', 'Explore online training inquiries through Soteria Services.'],
  '/courses': ['First Aid and Workplace Safety Training | Soteria Services', 'Explore first aid, CPR and workplace safety training inquiries for your organization.']
};

function expansionPage(title, summary, sections, cta, href) {
  return hero(esc(title), esc(summary), 'Contact Us') + '<section class="section"><div class="grid two">' + sections.map(section => '<article><h2>' + esc(section[0]) + '</h2><p>' + esc(section[1]) + '</p></article>').join('') + '</div><div class="actions"><a class="btn" href="' + href + '" data-link>' + esc(cta) + '</a></div></section>';
}

function businessInquiry(kind) {
  const medical = kind === 'medical';
  const fields = medical
    ? [['project','Project or event name'],['location','Location'],['dates','Dates'],['participants','Number of participants or workers'],['operations','Nature of operations and medical risks'],['hours','Coverage hours and staffing requirements'],['qualifications','Required medical qualifications'],['infrastructure','Existing medical infrastructure and evacuation arrangements']]
    : [['location','Training location'],['course','Requested course'],['participants','Number of participants'],['dates','Preferred dates'],['renewal','Certification renewal deadlines'],['requirements','Additional training requirements']];
  const serviceType = medical ? '<div class="field"><label for="business-serviceType">Service type</label><select id="business-serviceType" name="serviceType"><option>Event Medical</option><option>Remote Medical</option></select></div>' : '';
  return hero(medical?'Request Medical Coverage':'Corporate Training Inquiry', medical?'Tell us about your event or worksite.':'Plan workplace training for your team.', 'Contact Us') + '<section class="section"><form id="business-inquiry" class="card" data-kind="'+kind+'"><div class="form-grid"><div class="field"><label for="business-name">Contact name</label><input id="business-name" name="name" required></div><div class="field"><label for="business-org">Organization</label><input id="business-org" name="organization" required></div><div class="field"><label for="business-email">Email</label><input id="business-email" type="email" name="email" required></div><div class="field"><label for="business-phone">Phone</label><input id="business-phone" type="tel" name="phone" required></div>' + serviceType + fields.map(([name,label])=>'<div class="field"><label for="business-'+name+'">'+label+'</label><input id="business-'+name+'" name="'+name+'"></div>').join('') + '</div><div class="actions"><button class="btn" type="submit">Submit Inquiry</button></div><div id="business-inquiry-message" role="status"></div></form></section>';
}

function equipmentCategory(category) { return CatalogueSections.isEquipmentCategory(category); }
function shopEquipment() {
  const inventory = products().filter(p => equipmentCategory(p.category));
  const categories = [...new Set(['PRESTAN Equipment', ...inventory.map(p => p.category).filter(Boolean)])].sort();
  const requested = new URLSearchParams(location.search).get('category') || '';
  const selected = categories.includes(requested) ? requested : '';
  const visible = inventory.filter(p => !selected || p.category === selected);
  return hero('Shop Equipment', 'Explore available AEDs, supplies and safety equipment.', 'Contact Us') + '<section class="section"><div class="form-grid"><div class="field"><label for="shop-search">Search products</label><input id="shop-search" type="search" placeholder="Search equipment"></div><div class="field"><label for="shop-category">Category</label><select id="shop-category"><option value="">All categories</option>' + categories.map(category => '<option value="'+esc(category)+'" '+(category===selected?'selected':'')+'>'+esc(category)+'</option>').join('') + '</select></div></div><div id="shop-results" class="grid three" style="margin-top:24px">' + (visible.length ? visible.map(productCard).join('') : '<p>Contact us for current product availability and a quote.</p>') + '</div></section>';
}

const crcLoginNote = 'After purchase, you\'ll receive an email with instructions to log in to your course.';
const crcRefundNote = 'Online courses are non-refundable.';
function redCrossCourses() { return products().filter(product => product.category === 'Online Courses' && product.tag === 'Canadian Red Cross'); }
function redCrossCard(course) {
  return '<article class="card service-card"><div><span class="pill">Canadian Red Cross</span><h3><a href="' + productPath(course) + '" data-link>' + esc(course.name) + '</a></h3><p>' + esc(course.language) + '</p><p><strong>' + money(course.amount) + '</strong></p><p>' + esc(crcLoginNote) + '</p><p>' + esc(crcRefundNote) + '</p></div><label class="quote-quantity">Seats <input type="number" min="1" max="99" value="1" data-quote-card-quantity aria-label="Seats for ' + esc(course.name) + '"></label><div class="actions"><button class="btn" type="button" data-quote-add="' + esc(course.id) + '">Add to Cart</button></div></article>';
}
function redCrossSection() {
  const courses = redCrossCourses();
  return '<section class="section" id="canadian-red-cross-online-courses"><h2>Canadian Red Cross Online Courses</h2><p>These courses are offered by Soteria Services as an authorized reseller.</p><p>' + esc(crcRefundNote) + '</p><div class="grid three">' + (courses.length ? courses.map(redCrossCard).join('') : '<p>Contact us for current course availability.</p>') + '</div></section>';
}
function trainingCatalog() {
  const courses = products().filter(p => CatalogueSections.isTrainingProduct(p) && p.tag !== 'Canadian Red Cross');
  return expansionPage('Training & Courses', 'First aid, CPR and workplace training for individuals and organizations.', [
    ['First aid and CPR', 'Ask about emergency first aid, standard first aid, CPR/AED and basic life support options.'],
    ['Corporate training', 'Discuss group bookings and training at your workplace where appropriate.'],
    ['Workplace safety', 'Ask about available online and in-person safety courses. Course availability, certification and provider details are confirmed before booking.']
  ], 'Request Corporate Training', '/corporate-training') + '<section class="section"><h2>Online Courses</h2><p>Explore online course availability and enrollment inquiries.</p><a class="btn secondary" href="/online-courses" data-link>Canadian Red Cross Online Courses</a><h2>Available Training</h2><div class="grid three">' + (courses.length ? courses.map(productCard).join('') : '<p>Contact us for current courses and dates.</p>') + '</div></section>';
}

function onlineCourses() {
  const courses = products().filter(product => product.category === 'Online Courses' && product.tag !== 'Canadian Red Cross' && !CatalogueSections.isSupplierTrainingCourse(product));
  const form = courses.length?'<form id="online-course-inquiry" class="card"><h2>Request Enrollment</h2><div class="form-grid"><div class="field"><label for="online-course">Course</label><select id="online-course" name="course">'+courses.map(course=>'<option value="'+esc(course.id)+'">'+esc(course.name)+'</option>').join('')+'</select></div><div class="field"><label for="online-language">Preferred language</label><select id="online-language" name="language"><option>English</option><option>French</option></select></div><div class="field"><label for="online-name">Participant name</label><input id="online-name" name="name" required maxlength="150"></div><div class="field"><label for="online-email">Participant email</label><input id="online-email" name="email" type="email" required maxlength="254"></div><div class="field"><label for="online-org">Organization</label><input id="online-org" name="organization" maxlength="150"></div><div class="field"><label for="online-phone">Phone</label><input id="online-phone" name="phone" type="tel" maxlength="50"></div></div><button class="btn" type="submit">Request Enrollment</button><div id="online-inquiry-message" role="status"></div></form>':'';
  return hero('Online Courses','Request online training and confirm enrollment with Soteria.','Contact Us')+redCrossSection()+'<section class="section"><p>Enrollment is arranged by Soteria. Course and language availability are confirmed before enrollment; access is confirmed afterward. '+esc(crcRefundNote)+'</p><div class="grid three">'+(courses.length?courses.map(productCard).join(''):'<p>Contact us for current course availability.</p>')+'</div>'+form+'</section>';
}

function soteriaReady() {
  const tiers = [
    ['Bronze', 'Included with qualifying AED purchases, subject to the confirmed scope.'],
    ['Silver', 'Annual AED and first aid kit inspections, a report and certificate.'],
    ['Gold', 'Monthly visits and reports, priority service, inventory tracking and an annual preparedness review.'],
    ['Complete', 'Gold services plus additional equipment and preparedness categories for review.']
  ];
  const equipment = ['Fire extinguishers','Bleeding control kits','Eyewash stations','Oxygen kits','Naloxone kits','Emergency lighting','Exit maps','Emergency contacts','Emergency preparedness review'];
  return hero('Soteria Ready','Preparedness services tailored to your locations and equipment.','Contact Us')+'<section class="section"><div class="grid two">'+tiers.map(tier=>'<article><h2>'+esc(tier[0])+'</h2><p>'+esc(tier[1])+'</p></article>').join('')+'</div><p>Scope, pricing and service arrangements are confirmed in writing. Services do not guarantee legal compliance.</p><form id="ready-inquiry" class="card"><h2>Request a Soteria Ready Quote</h2><div class="form-grid"><div class="field"><label for="ready-tier">Package</label><select id="ready-tier" name="tier">'+tiers.map(tier=>'<option>'+esc(tier[0])+'</option>').join('')+'</select></div>'+[['aeds','Number of AEDs'],['kits','Number of first aid kits'],['buildings','Number of buildings'],['locations','Number of locations']].map(([name,label])=>'<div class="field"><label for="ready-'+name+'">'+label+'</label><input id="ready-'+name+'" name="'+name+'" type="number" min="0" max="10000" value="0"></div>').join('')+'<div class="field"><label for="ready-location">Service location</label><input id="ready-location" name="location" required maxlength="200"></div><div class="field"><label for="ready-name">Name</label><input id="ready-name" name="name" required maxlength="150"></div><div class="field"><label for="ready-organization">Organization</label><input id="ready-organization" name="organization" maxlength="150"></div><div class="field"><label for="ready-email">Email</label><input id="ready-email" name="email" type="email" required maxlength="254"></div><div class="field"><label for="ready-phone">Phone</label><input id="ready-phone" name="phone" type="tel" maxlength="50"></div><div class="field full"><label for="ready-needs">Additional needs</label><textarea id="ready-needs" name="needs" maxlength="2000"></textarea></div></div><fieldset><legend>Additional equipment and preparedness</legend>'+equipment.map((item,index)=>'<label><input type="checkbox" name="equipment" value="'+esc(item)+'"> '+esc(item)+'</label>').join(' ')+'</fieldset><button class="btn" type="submit">Request Quote</button><div id="ready-message" role="status"></div></form></section>';
}

function pulseListingPage() {
  return hero('Soteria Pulse', 'Soteria Pulse is a compliance service Soteria delivers for your workplace using the Pulse platform. It is not self-serve software, and there is no client sign-up. Soteria uses Pulse to track your AEDs and equipment, keep inspection and training records, and prepare reports for you.', 'Request a demo') + '<section class="section pulse-listing"><article class="card pulse-highlight"><h2>AED compliance</h2><p>AED compliance is the main part of the service.</p><ul><li>AED and equipment tracking, including pad and battery expiry dates. Soteria keeps these records for your workplace.</li><li>Inspection records. Soteria maintains the inspection record for your AEDs.</li><li>Readiness assessments and assessment visits. Soteria carries out the assessments and records them in Pulse.</li></ul></article><article class="card"><h2>Training records and reports</h2><ul><li>Certification and first aid/CPR training record tracking. Soteria tracks these records for you.</li><li>PDF compliance and executive reports. Soteria prepares the reports and shares them with you.</li></ul></article><article class="card"><h2>Coming soon</h2><ul><li>Automated expiry reminders and notifications.</li><li>A client portal.</li></ul></article><p class="notice">Subscription pricing is not available yet. Request a demo and Soteria will follow up.</p><form class="card" id="pulse-demo-form"><h2>Request a demo</h2><div class="form-grid"><div class="field"><label for="pulse-name">Name</label><input id="pulse-name" name="name" required maxlength="200"></div><div class="field"><label for="pulse-org">Organization</label><input id="pulse-org" name="organization" required maxlength="200"></div><div class="field"><label for="pulse-email">Email</label><input id="pulse-email" name="email" type="email" required maxlength="320"></div><div class="field"><label for="pulse-phone">Phone</label><input id="pulse-phone" name="phone" maxlength="50"></div><div class="field"><label for="pulse-sites">Number of sites</label><input id="pulse-sites" name="sites" inputmode="numeric"></div><div class="field"><label for="pulse-aeds">Number of AEDs</label><input id="pulse-aeds" name="aeds" inputmode="numeric"></div><div class="field full"><label for="pulse-message">Message</label><textarea id="pulse-message" name="message" maxlength="5000"></textarea></div></div><button class="btn" type="submit">Request a demo</button><div id="pulse-demo-message" role="status"></div></form></section>';
}

const expansionRoutes = {
  '/admin/supplier': () => supplierAdminPage(),
  '/shop-equipment': shopEquipment,
  '/courses': trainingCatalog,
  '/online-courses': onlineCourses,
  '/soteria-ready': soteriaReady,
  '/soteria-pulse': pulseListingPage,
  '/medical-services': () => expansionPage('Medical Services', 'Medical coverage inquiries for events, industrial operations and remote worksites.', [
    ['Event coverage', content('event-medical-services').body || 'Coverage can be discussed for festivals, sporting events, concerts, community gatherings and corporate events.'],
    ['Remote medical coverage', 'Request remote medical coverage for a site away from your main workplace. Share the location, dates and crew size. Sending a request does not confirm that coverage is available.'],
    ['What to include', 'Tell Soteria the site, the dates and how many people are expected. Soteria will follow up.'],
    ['Service arrangements', 'Availability and scope are confirmed by Soteria after the request. This page does not confirm coverage.']
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
  ], 'Explore Soteria Ready', '/soteria-ready'),
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
  const matches = products().filter(p => equipmentCategory(p.category) && (!category || p.category === category) && [p.name, p.description, p.category].some(value => String(value || '').toLowerCase().includes(query)));
  document.getElementById('shop-results').innerHTML = matches.length ? matches.map(productCard).join('') : '<p>No matching products. Contact us for assistance.</p>';
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'online-course-inquiry') return;
  event.preventDefault();
  const form=event.target, data=new FormData(form), button=form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  const course=products().find(product=>product.category==='Online Courses' && product.id===data.get('course'));
  if (!course) return setMessage('online-inquiry-message','<p class="notice" role="alert">This course is no longer available.</p>');
  button.disabled=true;
  try {
    const response=await fetch('/api/quote-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('name'),email:data.get('email'),organization:data.get('organization'),phone:data.get('phone'),serviceInterest:'Online course inquiry',message:'Course: '+course.name+' ['+course.id+']\nPreferred language: '+data.get('language')})});
    const result=await jsonResponse(response);
    if (!response.ok) throw new Error(result.error||'Your inquiry could not be submitted.');
    setMessage('online-inquiry-message','<p class="notice">Your enrollment inquiry was received. Enrollment and access are not yet confirmed.</p>'); form.reset();
  } catch(error) { setMessage('online-inquiry-message','<p class="notice" role="alert">'+esc(error.message||'Your inquiry could not be submitted.')+'</p>'); }
  finally { button.disabled=false; }
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'ready-inquiry') return;
  event.preventDefault();
  const form = event.target, data = new FormData(form), button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  const fields = ['tier','aeds','kits','buildings','locations','location','needs'];
  const message = ['Soteria Ready package inquiry', ...fields.map(field=>field+': '+String(data.get(field)||'')), 'Additional equipment: '+data.getAll('equipment').join(', ')].join('\n');
  try {
    const response = await fetch('/api/quote-request', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:data.get('name'), organization:data.get('organization'), email:data.get('email'), phone:data.get('phone'), serviceInterest:'Soteria Ready', message }) });
    const result = await jsonResponse(response);
    if (!response.ok) throw new Error(result.error || 'Your request could not be submitted.');
    setMessage('ready-message','<p class="notice">Your request was received. Soteria Services will follow up.</p>'); form.reset();
  } catch (error) { setMessage('ready-message','<p class="notice" role="alert">'+esc(error.message||'Your request could not be submitted.')+'</p>'); }
  finally { button.disabled = false; }
});
document.addEventListener('change', event => {
  if (event.target.id === 'shop-category') event.target.dispatchEvent(new Event('input', { bubbles: true }));
});

document.addEventListener('submit', async event => {
  if (event.target.id === 'pulse-demo-form') {
    event.preventDefault();
    const form = event.target, data = Object.fromEntries(new FormData(form)), button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch('/api/quote-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, serviceInterest: 'Soteria Pulse demo', message: ['Sites: ' + (data.sites || ''), 'AEDs: ' + (data.aeds || ''), data.message || ''].filter(Boolean).join('\n') }) });
      const result = await jsonResponse(response);
      if (!response.ok) throw new Error(result.error || 'Your request could not be saved.');
      setMessage('pulse-demo-message', '<p class="notice">Request received. Soteria will follow up.</p>');
      form.reset();
    } catch (error) {
      setMessage('pulse-demo-message', '<p class="notice" role="alert">' + esc(error.message || 'Your request could not be saved.') + '</p>');
    } finally { button.disabled = false; }
    return;
  }
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
