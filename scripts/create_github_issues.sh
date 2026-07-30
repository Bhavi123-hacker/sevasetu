#!/usr/bin/env bash
#
# Bulk-creates all 25 SevaSetu user stories as GitHub Issues.
#
# Prerequisites:
#   1. Install GitHub CLI: https://cli.github.com/
#   2. Authenticate:        gh auth login
#   3. Run from anywhere, but set REPO below to your actual repo.
#
# Usage:
#   chmod +x scripts/create_github_issues.sh
#   ./scripts/create_github_issues.sh
#
set -euo pipefail

REPO="YOUR-GITHUB-USERNAME/sevasetu"   # <-- change this before running

create_issue() {
  local title="$1"
  local body="$2"
  local priority_label="$3"
  local role_label="$4"

  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "user-story" \
    --label "$priority_label" \
    --label "$role_label"
}

echo "Creating 25 issues in $REPO ..."

create_issue "US-01: Select government service" \
  "As a citizen, I want to select which government service I'm applying for, so that the system knows which documents to expect from me." \
  "must-have" "citizen"

create_issue "US-02: See required documents upfront" \
  "As a citizen, I want to see the list of required documents for my chosen service before I upload anything, so that I don't waste a trip gathering the wrong papers." \
  "must-have" "citizen"

create_issue "US-03: Upload document photos/scans" \
  "As a citizen, I want to upload photos or scans of my documents, so that I don't have to visit an office just to submit paperwork." \
  "must-have" "citizen"

create_issue "US-04: Automatic OCR text extraction" \
  "As a citizen, I want the system to automatically read the text on my documents, so that I don't have to manually type in my details." \
  "must-have" "citizen"

create_issue "US-05: Cross-document mismatch detection" \
  "As a citizen, I want to be told if any of my documents disagree with each other (e.g. different addresses), so that I can fix the mistake before an officer sees it." \
  "must-have" "citizen"

create_issue "US-06: Plain-language mismatch explanation" \
  "As a citizen, I want a plain-language explanation of exactly which two documents disagree and how, so that I know precisely what to correct." \
  "should-have" "citizen"

create_issue "US-07: Overall readiness score" \
  "As a citizen, I want to see an overall readiness score for my application, so that I know at a glance whether it's likely to be processed smoothly." \
  "must-have" "citizen"

create_issue "US-08: Estimated delay from flagged issues" \
  "As a citizen, I want an estimate of how much my flagged issues could delay my application, so that I can decide whether it's worth fixing now or submitting anyway." \
  "should-have" "citizen"

create_issue "US-09: Clear next-step recommendation" \
  "As a citizen, I want a clear recommendation of what to do next (e.g. re-upload your Aadhaar), so that I don't have to guess how to resolve a flag." \
  "should-have" "citizen"

create_issue "US-10: Re-upload a corrected document" \
  "As a citizen, I want to re-upload a corrected document after a flag, so that my readiness score updates without starting the whole application over." \
  "should-have" "citizen"

create_issue "US-11: Duplicate submission warning" \
  "As a citizen, I want to be warned if I've already submitted this exact request before, so that I don't accidentally create a duplicate application." \
  "must-have" "citizen"

create_issue "US-12: Results in preferred language" \
  "As a citizen, I want to receive my results in my preferred language, so that a language barrier doesn't stop me from understanding my own application status." \
  "should-have" "citizen"

create_issue "US-13: Check application status later" \
  "As a citizen, I want to check the status of my application after I've submitted it, so that I don't have to call or visit the office for an update." \
  "should-have" "citizen"

create_issue "US-14: Blurry photo warning" \
  "As a citizen with a low-quality camera or scan, I want to be warned if my uploaded photo is too blurry to read, so that I re-take it before wasting a submission attempt." \
  "could-have" "citizen"

create_issue "US-15: Officer secure login" \
  "As an officer, I want to log in securely to my dashboard, so that citizen data is only visible to authorized staff." \
  "must-have" "officer"

create_issue "US-16: Queue sorted by readiness" \
  "As an officer, I want to see my queue of applications sorted by readiness score, so that I can process clean applications first and flag risky ones for closer review." \
  "must-have" "officer"

create_issue "US-17: Field-by-field mismatch detail view" \
  "As an officer, I want to open any flagged application and see exactly which fields mismatched and where, so that I don't have to manually re-read every document myself." \
  "must-have" "officer"

create_issue "US-18: Duplicate applications visibly separated" \
  "As an officer, I want duplicate-flagged applications visibly separated in my queue, so that I don't process the same request twice." \
  "should-have" "officer"

create_issue "US-19: Missing-document visibility" \
  "As an officer, I want to see which required documents are missing from an application, so that I can send one clear request instead of several back-and-forth emails." \
  "must-have" "officer"

create_issue "US-20: Mark application as resolved" \
  "As an officer, I want to mark an application as manually reviewed and resolved, so that it's removed from my active queue." \
  "could-have" "officer"

create_issue "US-21: Filter queue by service type" \
  "As an officer, I want to filter my queue by service type, so that I only see applications relevant to the desk I'm staffing." \
  "should-have" "officer"

create_issue "US-22: Search application by name or ID" \
  "As an officer, I want to search for an application by the citizen's name or ID, so that I can quickly find a specific case someone is asking about." \
  "could-have" "officer"

create_issue "US-23: Add a note to an application" \
  "As an officer, I want to add a short note to an application, so that the next officer who opens it knows what I already checked." \
  "wont-have" "officer"

create_issue "US-24: Clean-vs-flagged workload count" \
  "As an officer, I want a simple count of how many applications in my queue are clean versus flagged, so that I can gauge my day's workload at a glance." \
  "could-have" "officer"

create_issue "US-25: Configurable required-documents checklist" \
  "As an officer or admin, I want to update which documents are required for a given service type, so that the missing-document checklist stays accurate when rules change." \
  "wont-have" "officer"

create_issue "US-26: Ask a regulation question" \
  "As a citizen, I want to ask a question about the application process in plain language, so that I don't have to dig through official regulations myself." \
  "must-have" "citizen"

create_issue "US-27: See answer confidence" \
  "As a citizen, I want to see how confident the answer is, so that I know whether to trust it or ask an officer directly." \
  "should-have" "citizen"

create_issue "US-28: Submit feedback" \
  "As a citizen, I want to submit feedback about my experience, so that the officer team knows what's working and what isn't." \
  "must-have" "citizen"

create_issue "US-29: Link feedback to an application" \
  "As a citizen, I want to optionally link my feedback to a specific application, so that officers have context if they need to follow up." \
  "could-have" "citizen"

create_issue "US-30: Personal resolution count" \
  "As an officer, I want to see how many applications I've personally resolved, so that I can track my own workload over time." \
  "should-have" "officer"

create_issue "US-31: Volume by service type" \
  "As an officer, I want to see application volume broken down by service type, so that I know where demand is concentrated." \
  "could-have" "officer"

create_issue "US-32: Feedback sentiment summary" \
  "As an officer, I want to see a summary of citizen feedback sentiment, so that I can spot recurring problems in the process itself, not just in individual applications." \
  "should-have" "officer"

create_issue "US-33: Read raw feedback comments" \
  "As an officer, I want to read recent feedback comments directly, so that I understand issues in citizens' own words, not just as a sentiment score." \
  "could-have" "officer"

echo "Done. Created 33 issues in $REPO."
echo "That's 8 more than the assignment's 25 — see docs/user_stories_moscow.md for which six to drop if you need exactly 25."
echo "Add them to a GitHub Project board from the Issues tab -> Projects."
