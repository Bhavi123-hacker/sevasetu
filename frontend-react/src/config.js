// Mirrors frontend/config.py's SERVICE_TYPES. The backend is the real
// source of truth for which documents are required (via
// /api/service-requirements, editable by Administrators) — this list is
// only used to build the upload form's fields and labels, not to
// validate anything server-side.
export const SERVICE_TYPES = {
  income_certificate: {
    label: 'Income Certificate',
    requiredDocuments: {
      aadhaar: 'Aadhaar card',
      ration_card: 'Ration card',
      electricity_bill: 'Electricity bill',
      residence_proof: 'Residence proof',
    },
  },
  domicile_certificate: {
    label: 'Domicile Certificate',
    requiredDocuments: {
      aadhaar: 'Aadhaar card',
      residence_proof: 'Residence proof',
      birth_certificate: 'Birth certificate',
    },
  },
}
