"""
Regulation corpus for the RAG assistant.

These are illustrative regulation-style passages, written for this demo —
not scraped or copied from any real government document, so there's no
copyright question and nothing to keep in sync with a live source. They're
realistic enough to exercise retrieval properly. Swapping in real scheme
text later (e.g. from MyScheme.gov.in or a state's actual citizen-charter
PDF) is a drop-in replacement: re-run `index_corpus()` with the new chunks,
nothing else in the pipeline changes.
"""

INCOME_CERTIFICATE_CORPUS = [
    {
        "id": "eligibility",
        "text": (
            "Any resident of the state who has lived at their current address for at least "
            "one year is eligible to apply for an income certificate. There is no minimum "
            "income threshold to apply — the certificate simply records declared annual income "
            "for the purpose of scholarships, loan applications, and other government schemes."
        ),
    },
    {
        "id": "required_documents",
        "text": (
            "The documents required for an income certificate application are an Aadhaar card, "
            "a ration card or equivalent residence proof, a recent electricity or water bill as "
            "address verification, and a self-declaration of annual income. Salaried applicants "
            "should additionally attach a salary slip; self-employed applicants may attach a "
            "declaration in lieu of a salary slip."
        ),
    },
    {
        "id": "processing_time",
        "text": (
            "Applications with no flagged inconsistencies are typically processed within 3 to 5 "
            "working days. Applications with a document mismatch or a missing required document "
            "take longer, since they require manual officer review before a certificate can be "
            "issued — usually 7 or more working days from the date the citizen resolves the flag."
        ),
    },
    {
        "id": "appeals",
        "text": (
            "A citizen whose application is rejected may file an appeal with the tehsil office "
            "within 30 days of the rejection notice. Appeals should include the original "
            "application ID and a written explanation of the disputed decision. Appeals are "
            "reviewed by a senior officer, separate from the officer who processed the original "
            "application."
        ),
    },
    {
        "id": "validity",
        "text": (
            "An income certificate remains valid for one year from its date of issue. For "
            "scholarship and school-admission purposes, most institutions will only accept a "
            "certificate issued within the current academic year, so renewing before the "
            "certificate expires is recommended if it will be used repeatedly."
        ),
    },
    {
        "id": "fees",
        "text": (
            "There is no application fee for a first-time income certificate application. A "
            "nominal reissue fee applies if a citizen requests a duplicate copy of an "
            "already-issued certificate."
        ),
    },
    {
        "id": "where_to_apply",
        "text": (
            "Income certificate applications can be submitted online through this platform or "
            "in person at the citizen's local tehsil or taluk office. Online applications follow "
            "the same processing timeline as in-person applications and do not require a "
            "follow-up visit unless a document is flagged for review."
        ),
    },
    {
        "id": "duplicate_submissions",
        "text": (
            "Citizens should not submit a second application for the same service while an "
            "earlier one is still pending. Duplicate submissions do not speed up processing and "
            "may themselves be flagged for manual review, which can add delay rather than "
            "reduce it. Checking application status is the correct way to follow up on a "
            "pending request."
        ),
    },
]
