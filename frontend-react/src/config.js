// Fallback service catalog used if backend is loading or unreachable.
// The backend /api/services endpoint is the primary source of truth.

export const DOCUMENT_TYPE_LABELS = {
  aadhaar: 'Aadhaar Card',
  ration_card: 'Ration Card',
  electricity_bill: 'Electricity Bill',
  residence_proof: 'Residence Proof',
  birth_certificate: 'Birth Certificate',
  income_proof: 'Income Proof / Salary Slip',
  caste_proof: 'Community / Caste Proof',
  age_proof: 'Age Proof (10th Certificate / Birth Record)',
  disability_certificate: 'Medical Disability Certificate',
  id_proof: 'Photo ID Proof (Voter ID / PAN)',
  affidavit: 'Self-Declaration Affidavit',
}

export const DEFAULT_SERVICE_CATALOG = [
  {
    id: 'income_certificate',
    name: 'Income Certificate',
    category: 'Revenue & Welfare',
    description: 'Proof of family annual income for scholarships, fee concessions, and government welfare benefits.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'ration_card', label: 'Ration Card', is_required: true },
      { key: 'electricity_bill', label: 'Electricity Bill', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
    ],
  },
  {
    id: 'domicile_certificate',
    name: 'Domicile Certificate',
    category: 'Citizenship & Residence',
    description: 'Proof of permanent state residency for government jobs, educational admissions, and state quotas.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
      { key: 'birth_certificate', label: 'Birth Certificate', is_required: true },
    ],
  },
  {
    id: 'caste_certificate',
    name: 'Caste Certificate',
    category: 'Social Welfare',
    description: 'Official community certification for claiming statutory reservation and affirmative action schemes.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'ration_card', label: 'Ration Card', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
      { key: 'caste_proof', label: 'Community / Caste Proof', is_required: true },
    ],
  },
  {
    id: 'residence_certificate',
    name: 'Residence Certificate',
    category: 'Citizenship & Residence',
    description: 'Certification of local residential address for municipal services and domestic utility connections.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'electricity_bill', label: 'Electricity Bill', is_required: true },
      { key: 'ration_card', label: 'Ration Card', is_required: true },
    ],
  },
  {
    id: 'birth_certificate',
    name: 'Birth Certificate',
    category: 'Vital Statistics',
    description: 'Official government record of birth registration for identity establishment and school admissions.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
      { key: 'birth_certificate', label: 'Birth Certificate', is_required: true },
    ],
  },
  {
    id: 'ews_certificate',
    name: 'Economically Weaker Section (EWS) Certificate',
    category: 'Revenue & Welfare',
    description: 'Eligibility certificate for 10% EWS reservation in central and state educational and employment institutions.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'income_proof', label: 'Income Proof / Salary Slip', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
      { key: 'electricity_bill', label: 'Electricity Bill', is_required: true },
    ],
  },
  {
    id: 'senior_citizen_certificate',
    name: 'Senior Citizen Certificate',
    category: 'Social Welfare',
    description: 'Certification for citizens aged 60+ to access public transport concessions and senior citizen welfare benefits.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'age_proof', label: 'Age Proof (10th Certificate / Birth Record)', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
    ],
  },
  {
    id: 'disability_certificate',
    name: 'Disability Certificate',
    category: 'Health & Empowerment',
    description: 'Medical authority certification for persons with benchmark disabilities to access assistive devices and quotas.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'disability_certificate', label: 'Medical Disability Certificate', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
    ],
  },
  {
    id: 'character_certificate',
    name: 'Character Certificate',
    category: 'General Administration',
    description: 'Verification of conduct and character for government employment, license applications, and educational admissions.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
      { key: 'id_proof', label: 'Photo ID Proof (Voter ID / PAN)', is_required: true },
    ],
  },
  {
    id: 'family_membership_certificate',
    name: 'Family Member Certificate',
    category: 'Revenue & Welfare',
    description: 'Official certificate listing recognized members of a household for family benefits and succession claims.',
    required_documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
      { key: 'ration_card', label: 'Ration Card', is_required: true },
      { key: 'residence_proof', label: 'Residence Proof', is_required: true },
      { key: 'birth_certificate', label: 'Birth Certificate', is_required: true },
    ],
  },
]

// Backward-compatible dictionary mapping
export const SERVICE_TYPES = Object.fromEntries(
  DEFAULT_SERVICE_CATALOG.map((s) => [
    s.id,
    {
      label: s.name,
      requiredDocuments: Object.fromEntries(
        s.required_documents.map((d) => [d.key, d.label])
      ),
    },
  ])
)
