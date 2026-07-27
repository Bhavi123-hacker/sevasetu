# User Stories & MoSCoW Prioritization

25 user stories, each written as `As a [user type], I want to [action], so that [benefit]`. Each is tagged with a priority so it can go straight into a GitHub Issue with a matching label. `scripts/create_github_issues.sh` creates all 25 as GitHub Issues in one run.

## Citizen stories

| ID | Story | Priority |
|---|---|---|
| US-01 | As a citizen, I want to select which government service I'm applying for, so that the system knows which documents to expect from me. | Must |
| US-02 | As a citizen, I want to see the list of required documents for my chosen service before I upload anything, so that I don't waste a trip gathering the wrong papers. | Must |
| US-03 | As a citizen, I want to upload photos or scans of my documents, so that I don't have to visit an office just to submit paperwork. | Must |
| US-04 | As a citizen, I want the system to automatically read the text on my documents, so that I don't have to manually type in my details. | Must |
| US-05 | As a citizen, I want to be told if any of my documents disagree with each other (e.g. different addresses), so that I can fix the mistake before an officer sees it. | Must |
| US-06 | As a citizen, I want a plain-language explanation of exactly which two documents disagree and how, so that I know precisely what to correct. | Should |
| US-07 | As a citizen, I want to see an overall readiness score for my application, so that I know at a glance whether it's likely to be processed smoothly. | Must |
| US-08 | As a citizen, I want an estimate of how much my flagged issues could delay my application, so that I can decide whether it's worth fixing now or submitting anyway. | Should |
| US-09 | As a citizen, I want a clear recommendation of what to do next (e.g. "re-upload your Aadhaar"), so that I don't have to guess how to resolve a flag. | Should |
| US-10 | As a citizen, I want to re-upload a corrected document after a flag, so that my readiness score updates without starting the whole application over. | Should |
| US-11 | As a citizen, I want to be warned if I've already submitted this exact request before, so that I don't accidentally create a duplicate application. | Must |
| US-12 | As a citizen, I want to receive my results in my preferred language, so that a language barrier doesn't stop me from understanding my own application status. | Should |
| US-13 | As a citizen, I want to check the status of my application after I've submitted it, so that I don't have to call or visit the office for an update. | Should |
| US-14 | As a citizen with a low-quality camera or scan, I want to be warned if my uploaded photo is too blurry to read, so that I re-take it before wasting a submission attempt. | Could |

## Officer stories

| ID | Story | Priority |
|---|---|---|
| US-15 | As an officer, I want to log in securely to my dashboard, so that citizen data is only visible to authorized staff. | Must |
| US-16 | As an officer, I want to see my queue of applications sorted by readiness score, so that I can process clean applications first and flag risky ones for closer review. | Must |
| US-17 | As an officer, I want to open any flagged application and see exactly which fields mismatched and where, so that I don't have to manually re-read every document myself. | Must |
| US-18 | As an officer, I want duplicate-flagged applications visibly separated in my queue, so that I don't process the same request twice. | Should |
| US-19 | As an officer, I want to see which required documents are missing from an application, so that I can send one clear request instead of several back-and-forth emails. | Must |
| US-20 | As an officer, I want to mark an application as manually reviewed and resolved, so that it's removed from my active queue. | Could |
| US-21 | As an officer, I want to filter my queue by service type, so that I only see applications relevant to the desk I'm staffing. | Should |
| US-22 | As an officer, I want to search for an application by the citizen's name or ID, so that I can quickly find a specific case someone is asking about. | Could |
| US-23 | As an officer, I want to add a short note to an application, so that the next officer who opens it knows what I already checked. | Won't (this iteration) |
| US-24 | As an officer, I want a simple count of how many applications in my queue are clean versus flagged, so that I can gauge my day's workload at a glance. | Could |
| US-25 | As an officer or admin, I want to update which documents are required for a given service type, so that the missing-document checklist stays accurate when rules change. | Won't (this iteration) |

## Why the two "Won't" stories are deferred

Both US-23 and US-25 are real, reasonable features — they're deferred, not rejected. A hardcoded checklist and no note-taking are honest, working shortcuts for a first version; both are natural additions once the core pipeline (OCR → consistency → readiness) is proven out.

## Priority counts

- **Must have:** 11 stories — the core pipeline (upload → OCR → consistency → readiness score) plus basic officer access.
- **Should have:** 8 stories — meaningful improvements that aren't required for the pipeline to make sense end to end.
- **Could have:** 4 stories — polish and convenience.
- **Won't have (this iteration):** 2 stories — explicitly documented, deliberately deferred.
