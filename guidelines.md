# Learning App V0.2 Product Requirements

## Purpose
- Provide a clear, LLM-friendly blueprint for implementing the learning app experience.
- Align product, design, and engineering teams on scope, success criteria, and UI conventions.
- Serve as an ongoing reference for future iterations beyond V0.2.

## Product Vision
Create a mood-aware learning companion that rewards consistent participation, delivers weekly assignments with clear guidance, and keeps users motivated through coins, streaks, and badges.

## Target Users
- Primary: Adult learners enrolled in a 12-week mentored program who need structured assignments and encouragement.
- Secondary: Mentors reviewing submissions and tracking learner progress.

## Success Metrics
- 80% of active users complete the login and mood affirmation flow within their first session.
- 70% weekly assignment submission rate by Week 4.
- <5% user-reported issues related to accessibility, contrast, or responsiveness.

## Assumptions & Constraints
- Users receive a unique 5-character alphanumeric access code in advance.
- The app operates primarily in dark mode; no light theme required for V0.2.
- Coins, streaks, and badges can default to placeholder values until real data is wired.
- Internet connectivity is available; offline support is not in scope.

## Functional Requirements
### Section 01: Login
- **UI Elements**: centered 5-character alphanumeric text input (`Enter your Code`) and a primary `Log In` button.
- **Validation**: reject entries that are not exactly 5 characters or contain disallowed symbols; show inline helper/error messaging.
- **Keyboard Behavior**: auto-focus input on load; enable Enter key to trigger login.
- **State Handling**: disabled button until input length is 5; show loading state during authentication attempts.

### Section 02: Mood Affirmations
- **Flow**: three sequential screens (Emotion, Motivation, Energy) immediately after successful login.
- **Content**: each screen presents the prompt, five options combining emoticons and short text labels.
- **Navigation**: single-selection; `Next` button advances; `Back` returns to previous screen; `Skip` optional if data unavailable.
- **Data Capture**: store responses per session; allow editing until dashboard loads.
- **Feedback**: subtle transitions between screens; confirmation toast once all three are submitted.

### Section 03: Dashboard
Single-page layout with header, body, and footer modules.

#### Header
- **Greeting**: time-of-day greeting (`Good morning/afternoon/evening`) + user first name on left.
- **Status Metrics**: right-aligned pill group with icons and default values for coins, streak streak count, and badges earned.
- **Interactivity**: hover tooltips clarify metric definitions; values update dynamically when user earns rewards.

#### Body
- **Week Context**: display current week out of 12 (`Week 4 of 12`), numeric progress, and a percentage progress bar.
- **Resource Links**: `Custom GPT for the Week` and `Notebook for the Week` as text links with external-link affordance.
- **Action Cards**: six cards per week (five weekdays + Week wrap-up), stacked vertically.
  - Default state: all collapsed except the current day; past days remain expanded for review; future days require unlocking with coins.
  - Title: assignment name; right-aligned status pill (`Pending`, `Submitted`, `Checked`) with color-coded states and accessible text contrast.
  - Content: 5-line description including requirements and submission due date (same day, or upcoming Monday for week card).
  - Buttons:
    - `Submit Assignment` (expanded cards only) opens submission modal; becomes `Edit Submission` after initial submit until status is `Checked` (then disabled).
    - `Unlock Assignment` shows only on locked future cards; triggers confirmation modal deducting coins.
  - Hint Link: `Hints will cost you X coins`; opens confirmation modal; on acceptance show hints inline or within modal; on cancel close modal with no deduction.
  - Submission Modal: supports up to 10 image uploads and a text input for external link; requires at least one field to submit. Includes visible `Submit` button and success toast. Closing modal updates card status and button label.

#### Footer
- **Weekly Progress Bar**: aggregated completion percentage for the current week with label.
- **Microcopy**: optional motivational text or reminder (`Keep the streak alive!`).

## User Journeys
1. **First-Time Login**: user enters code, completes mood affirmations, lands on dashboard with current day card expanded.
2. **Daily Assignment**: user reviews expanded card, submits work, receives confirmation toast, status updates to `Submitted`.
3. **Unlocking Future Work**: user spends coins to unlock future card, reads assignment, optionally requests hints, and submits early.

## Error & Edge States
- Invalid login code: inline error and shake animation.
- Network failures during submit: keep modal open, show toast with retry option.
- Coins insufficient for unlock/hints: disabled button with tooltip or modal explanation.
- Upload limit reached: display inline message near upload control.

## UI & Interaction Guidelines
- **Color Palette**: Dark grey (#111318) background, light grey (#2A2F36) surfaces, accent red (#FF4444) for primary actions, soft neutrals for text. Maintain minimum 4.5:1 contrast.
- **Typography**: Inter family; headings 30 or 21 px; subheadings 21 or 18 px; paragraph text 15 px; helper/toast text 9 px. Use bold/italic/underline sparingly for emphasis.
- **Spacing**: major component gaps 30 or 60 px; line-to-line spacing 15 px for separate ideas, 6 px for related items.
- **Corners**: use 9 px for compact elements, 15 px for medium cards/buttons, 21 px for large containers.
- **Buttons**: minimum height 45 px; primary buttons use accent red, secondary buttons use lighter greys with high contrast text.
- **Effects**: blend glassmorphism (semi-transparent panels, frosted blur) with neumorphic highlights/shadows; keep motion subtle (200-300 ms) and ease-in-out.
- **Icons**: consistent stroke weight; provide accessible labels for coins, streaks, badges.
- **Toasts**: bottom-right placement, auto-dismiss after 4 s with manual close option.

## Accessibility Requirements
- All actionable elements keyboard navigable; focus outlines visible at 3 px.
- Provide text alternatives for emoticon options and icons.
- Avoid color-only cues; pair with text labels or shapes.
- Announce modal open/close events to screen readers; trap focus inside modal.

## Responsive Behavior
- **Mobile (base)**: single-column layout; header metrics collapse into horizontal scroll or dropdown; action cards stack with swipe to collapse/expand.
- **Tablet**: two-column body where widened cards appear; metrics remain inline.
- **Desktop**: card list centered with max width; header metrics right-aligned.
- Breakpoints: mobile <768 px, tablet 768-1199 px, desktop >=1200 px.

## Data & Content Model
- **User Profile**: id, name, access code, coin balance, streak count, badges earned.
- **Assignments**: id, week, day, title, description, due date, status, hint cost, unlock cost.
- **Mood Logs**: session id, timestamp, emotion, motivation, energy rating.
- **Submissions**: assignment id, uploaded assets (max 10), external link, status history.

## Integrations & APIs
- Authentication endpoint validates access codes and returns user profile.
- Dashboard API delivers weekly plan, coins, streaks, badges, and submission statuses.
- File storage service for image uploads with size validation.

## Analytics & Instrumentation
- Track login success/failure, mood selections, card unlock events, hint consumption, submission attempts, and modal confirmations.
- Capture page load times and error rates to monitor performance.

## Non-Functional Requirements
- Page transitions under 300 ms on target devices.
- Upload modal should support cumulative image payloads up to 25 MB.
- System shows graceful degradation if icons/assets fail to load.

## QA & Testing Considerations
- Unit tests for validation logic, coin deductions, and status updates.
- Automated accessibility tests (contrast, keyboard navigation).
- Responsive snapshots across target breakpoints.
- Integration tests for submission flow including upload retry and edit restrictions after `Checked`.

## Open Questions
1. What is the exact mapping between coin deductions and unlock/hint costs per card?
2. How are streaks calculated (calendar days vs. assignment completion days)?
3. Should learners receive notifications when assignments are marked `Checked`?
4. Do mentors need an administrative interface in V0.2?
5. Are multilingual requirements in scope?
