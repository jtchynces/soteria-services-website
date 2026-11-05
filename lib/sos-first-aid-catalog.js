// SOS collection identities for local preview and administrator-reviewed drafts.
const records = [
  ['sos-ontario-sec9-kit-plastic', 'First Aid Kits', 'Ontario Sec. 9 First Aid Kit, Plastic', 'An Ontario Section 9 first aid kit in a plastic container.'],
  ['sos-water-jel-pouch-kit', 'First Aid Kits', 'Water-Jel Pouch Kit', 'A Water-Jel burn care kit in a pouch.'],
  ['sos-water-jel-emergency-kit-i', 'First Aid Kits', 'Water-Jel Emergency Burn Kit I', 'A Water-Jel emergency burn care kit.'],
  ['sos-eye-dressing-kit', 'First Aid Kits', 'Eye Dressing Kit', 'An eye dressing kit.'],
  ['sos-bzk-antiseptic-towelette-12', 'First Aid Supplies', 'BZK Antiseptic Towelette (12)', 'A pack of twelve antiseptic towelettes.'],
  ['sos-bzk-antiseptic-towelette-100', 'First Aid Supplies', 'BZK Antiseptic Towelette 100', 'A pack of one hundred antiseptic towelettes.'],
  ['sos-cpr-barrier-mask-economy', 'First Aid Supplies', 'CPR Barrier Mask Economy', 'A CPR barrier mask.'],
  ['sos-cpr-barrier-gloves-wipe-pouch', 'First Aid Supplies', 'CPR Barrier with Gloves, Wipe and Pouch', 'A CPR barrier with gloves, a wipe and a pouch.']
];
module.exports = records.map(([id, category, name, description]) => ({
  id, category, name, description, amount: 0, currency: 'cad',
  tax_behavior: 'confirm_manually', inventory_status: 'quote_required',
  image_url: '', mode: 'request_quote', enabled: true
}));
