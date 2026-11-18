// Product identities reviewed against the linked SOS collections. No stock or prices are asserted.
const records = [
  ['sos-prestan-adult-2000', 'PRESTAN Equipment', 'PRESTAN Professional Adult Series 2000 CPR Training Manikin', 'Adult CPR training manikin from the PRESTAN Professional Series 2000.'],
  ['sos-prestan-adult-2000-four', 'PRESTAN Equipment', 'PRESTAN Professional Adult Series 2000 CPR Training Manikin 4-Pack', 'Four-pack of PRESTAN Professional Adult Series 2000 CPR training manikins.'],
  ['sos-prestan-child-monitor', 'PRESTAN Equipment', 'PRESTAN Child CPR-AED Manikin with CPR Monitor', 'Child CPR training manikin with a CPR monitor.'],
  ['sos-prestan-infant-2000', 'PRESTAN Equipment', 'PRESTAN Professional Infant Series 2000 Manikin', 'Infant CPR training manikin from the PRESTAN Professional Series 2000.'],
  ['sos-prestan-family-pack', 'PRESTAN Equipment', 'PRESTAN Professional Family Pack', 'A CPR training manikin collection with adult, child and infant manikins.'],
  ['sos-prestan-ultratrainer-four', 'PRESTAN Equipment', 'PRESTAN AED UltraTrainer 4-Pack', 'Four-pack of PRESTAN AED training devices.'],
  ['sos-prestan-adult-lungs', 'PRESTAN Equipment', 'PRESTAN Adult Face-Shield Lung Bags, 50', 'A 50-pack of face-shield lung bags for PRESTAN adult manikins.'],
  ['sos-prestan-infant-lungs', 'PRESTAN Equipment', 'PRESTAN Infant Face-Shield Lung Bags, 50', 'A 50-pack of face-shield lung bags for PRESTAN infant manikins.'],
  ['sos-prestan-replacement-faces', 'PRESTAN Equipment', 'Replacement Faces for PRESTAN Adult Manikin', 'Replacement faces for PRESTAN adult training manikins.'],
  ['sos-prestan-trainer-pads', 'PRESTAN Equipment', 'PRESTAN AED Trainer Replacement Pads', 'Replacement pads for PRESTAN AED training equipment.'],
  ['sos-zoll-aed-3', 'AED Sales', 'ZOLL AED 3', 'An AED from ZOLL. Contact Soteria for a quotation and configuration details.'],
  ['sos-zoll-aed-plus', 'AED Sales', 'ZOLL AED Plus', 'An AED from ZOLL. Contact Soteria for a quotation and configuration details.'],
  ['sos-defibtech-lifeline', 'AED Sales', 'Defibtech Lifeline AED', 'An AED from Defibtech. Contact Soteria for a quotation and configuration details.'],
  ['sos-lifeline-view', 'AED Sales', 'Defibtech Lifeline View AED', 'An AED from Defibtech. Contact Soteria for a quotation and configuration details.'],
  ['sos-lifeline-view-adult-pads', 'AED Pads & Batteries', 'Defibtech Lifeline View Adult Pads', 'Adult replacement pads for the Defibtech Lifeline View AED.'],
  ['sos-zoll-aed-3-battery', 'AED Pads & Batteries', 'ZOLL AED 3 Battery Pack', 'Replacement battery pack for the ZOLL AED 3.']
];

module.exports = records.map(([id, category, name, description]) => ({
  id, category, name, description, amount: 0, currency: 'cad',
  tax_behavior: 'confirm_manually', inventory_status: 'quote_required',
  image_url: '', mode: 'request_quote', enabled: true
}));
