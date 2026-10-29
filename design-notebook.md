# Design Notebook

## October 5, 2026

I considered several possible concepts, including `Reserving` and `GroupFavoriting`, but reduced the design to five concepts.

Final concepts:

- `EventPublishing` — create and update event information.
- `EventMarking` — let users mark events as `Might Go` or `Going`.
- `GroupJoining` — manage membership in groups, including private groups.
- `Commenting` — support discussion around events.
- `Notifying` — notify users about relevant changes or activity.

I combined saving/reserving behavior into `EventMarking` because the current app mainly represents attendance intention rather than guaranteed reservations.

I kept `GroupJoining` because some groups and events are private. I removed `GroupFavoriting` because it is less central to the main problem.

The concepts should remain independent and interact through reactions, for example:



## October 9 - 13, 2026

### MVP Planning

For my MVP, I decided to focus on groups, events, and event marking. I left commenting and notifications for later since they aren't necessary for the main user journey.

At first, I planned to use an initialization script with 10 predefined users (user1, user2, etc.) to make testing easier. But later I decided to just fully implement registration and login instead of using stub users.

The main user journey is:
1. User1 creates a group and publishes an event.
2. User2 requests to join the group.
3. User1 approves the request.
4. User2 can now see the group's events and mark them as Going or Interested.
5. These events appear in My Events and Calendar.
6. User2 can later change their response or remove the mark.

I also decided to have a default **MIT Campus** group that everyone joins automatically. This group is used for campus-wide events.

### Setup and Concepts

- Set up Bun, sync-engine, TypeScript, and MongoDB.
- Started writing concepts in the `design` folder.
- Changed `MightGo` to `Interested`.
- Implemented six concepts: Registering, Authenticating, Sessioning, Grouping, EventPublishing, and EventMarking.

### Main Design Decisions

While implementing the concepts, I made some changes to simplify the app and make its behavior clearer.

**Groups**
- Groups can be OPEN or APPROVAL.
- Any member can approve requests or change the joining policy. I decided not to have admins for now.
- Users can leave groups, but not if they still organize an uncanceled event there.
- When someone leaves a group, their event marks from that group are deleted.
- Groups can become empty, and a group with only one member can be deleted.

**Events**
- Every event belongs to a group, and only group members can see it.
- Any member can publish events, but only the creator can edit or cancel them.
- I decided that canceling an event shouldn't delete it completely. People who saved it can still see it, but it will be marked as canceled.
- Event creators can see who marked Going or Interested.
- For now, I'm assuming all events are upcoming.

**Event Marking and Calendar**
- Users can mark events as Going, Interested, or Not Going.
- They can change their response or remove it completely.
- Going and Interested events appear in My Events and Calendar.
- Not Going events don't appear there.
- Canceled events stay in the calendar if the user already saved them.
- I also added a way to show when an event's time has changed, including its old and new time.

### Implementation

After finishing the initial design, I started implementing everything.
1.  Set up the database and implemented all six concepts separately in TypeScript.
2. Added tests for registration, sessions, groups, events, and event marking.
3. ** Connected concepts using endpoints, views, formers, and computations to implement the actual app workflows.
4. Added HTTP endpoints, session cookies, request validation, and error handling. Also added a shared request queue.
5.  Built the Vue frontend with registration/login, groups, events, event marking, My Events, and Calendar.
6.  Added an MIT-inspired crimson theme and logo.
7. Fixed some issues with duplicate usernames, database resets, and old server processes. Ran concept, composition, HTTP, and TypeScript tests.

### Future Plans

There are still some features I want to add later:

-  Notify users when saved events are edited or canceled, or when group requests are approved/rejected.
-  Allow users to upload images. I'm also considering AI-generated pictures based on event descriptions.
-  Let users invite specific people to events.
-  Separate upcoming and past events while keeping calendar history.
-  Add password recovery and maybe MIT authentication.
-  Import existing MIT events into the app.
-  Allow users to export events to Google Calendar or other calendars.

# P3

## October 13-20, 2026

### Adding Commenting and Notifying

I decided to add Commenting and Notifying.  I thought these features would make the app much more useful, because students should be able to discuss events and know when something changes. I decided that only current group members should be able to comment, even if the event is canceled. I wanted discussions to stay connected to the group. Authors can edit their comments and organizers can delete them too. For notifications, I didn't want to notify people about every little change. So I decided to only send notifications when event time/location changes or an event gets canceled. Only people who marked Going or Interested get these notifications, because they are the ones affected by changes. I also wanted Commenting and Notifying to be independent concepts. They shouldn't need to understand group membership or event status themselves. I kept this logic in reactions and application composition. Implemented both concepts, connected them to frontend and tested with two users. I tested private group joining, comments, changing events and receiving notifications.


### Event and group pictures

I decided to add pictures to events and groups. I thought event covers would make it easier to recognize events, and group pictures would give groups more identity. Initially I mentioned group chats, but I actually meant group theme pictures, not messaging. I decided to store pictures as part of EventPublishing and Grouping instead of creating another concept, because pictures are just properties of events/groups. Also added browser-side resizing because I didn't want large images taking up too much storage.

### Typography experiments

I started working on the visual design for P3. I wanted different pages to have a bit of their own personality, so initially I tried different fonts: Space Grotesk for Explore, Plus Jakarta Sans for Groups, Roboto Flex for Calendar and DM Sans for other pages. I kept body text consistent because I didn't want the whole application to look completely different on every page.

### Colors and Material Design

I wanted the app to feel fun and friendly, not like a very serious university portal. I used my inspiration collage with Japanese/matcha/citrus colors and tried three different palettes. At first I applied them to different pages, but I realized it made the pages feel too disconnected. I also looked at [Google Material Design](https://m3.material.io/) for ideas about layout, spacing, typography, navigation and buttons. I changed the entire UI to use rounded cards, bigger buttons, more consistent spacing and page headers. I also added side navigation for desktop and bottom navigation for phones because the desktop sidebar was taking too much space on small screens. Then I combined the palettes into one with pink, matcha green, yellow, teal, coral and cream backgrounds. I still wanted each page to have its own color, but now they all use the same overall palette. Some of the text didn't have enough contrast with the backgrounds, so I made text darker and changed button colors. I wanted to keep the pastel colors but also make everything readable. I also wanted changed events to stand out. I used orange for time changes, green for Going, blue-gray for Interested and red for canceled events. I thought these colors would help users understand their calendar more quickly. I also kept text labels so meaning doesn't depend only on colors.

### Group picture layout

At first I displayed group pictures as large banners. But I didn't like how much space they were taking, especially in group cards. So I moved pictures into rounded group icons. If a group doesn't have a picture, its initials appear instead. I think this looks cleaner and makes groups easier to scan.

### Renaming the app and creating a logo

I noticed that I was mixing up name of the app. Some places i had it named InfinitePlans some places InfiniteWeek. I changed all names to InfiniteWeek.


### Final typography choice

I found Griffy on Google Fonts and really liked it because it feels more playful and interesting than the fonts I had before. Initially I used Griffy for lots of headings, including cards and dialogs. But I realized it was too decorative and made smaller text harder to read. So I decided to keep Griffy only for main page headings and the app name. I chose Lora for everything else because it has a similar feeling but is much easier to read. I thought using just two fonts would also make the UI more consistent. I used locally stored fonts so the app doesn't depend on Google Fonts loading every time.

### Event changes and notifications

I realized the calendar should distinguish changed events from normal ones, but I didn't want to store and show every historical change there. So I decided to show only the latest time change with previous and current times. If the event gets canceled, cancellation takes priority because it's more important for someone planning to attend. I also kept title and description edits silent, because I thought users would get too many unnecessary notifications otherwise.

### Comment replies and notifications

I changed my earlier decision about comment notifications. Originally comments didn't generate notifications, but then I realized people attending an event might want to know if there is a discussion.I decided that only users marked Going should receive comment notifications, not Interested users, because I don't want to overwhelm everyone. I also added replies to comments. I wanted to allow some conversation but didn't want deeply nested threads, so I limited the visual indentation to one level. Replies to replies still belong to the same thread. I decided clicking a notification should open the exact comment and highlight it, because just opening the event would make users search for the message themselves.There was a bug where the page tried to locate a comment before rendering it, so I changed the order and added tests.

### Calendar Day and Week views

I originally only had Month view, but I realized that isn't very useful when students have multiple events on the same day. So I added Day and Week views to make it easier to see actual schedules. One issue was overlapping events. Initially they could cover each other, so I changed the layout to put simultaneous events next to each other.Week view also didn't fit well on mobile. Instead of making all events very narrow, I made the calendar horizontally scrollable while keeping the rest of the page from overflowing. I also made sure events continuing past midnight appear on both days.

### Your groups and Explore groups

Originally I displayed all groups together, but I thought this was confusing. Groups I'm already in and groups I want to discover serve different purposes. So I separated them into **Your groups** and **Explore groups**. Pending requests stay in Explore, and after joining, a group moves to Your groups. I kept the same search for both sections because I didn't think separate searches were necessary.
## October 20, 2026

### Preparing for deployment

I started preparing InfiniteWeek for the class deployment platform. Previously frontend and backend were running separately during development, so I needed to set up a proper production build. I added scripts at the repository root, configured Bun and Vite, and made one server handle the frontend and backend. I also changed request handling because incomplete uploads could block other requests. I added request limits and handling for interrupted requests, so one unfinished request wouldn't prevent other people from using the app. I also made static file serving more restrictive because I didn't want the production server exposing project files that shouldn't be public. I tested the production version with registration, group creation, event publishing, commenting, picture uploading, My Events and Calendar.

## October 20-28, 2026

### Fixing comment and reply notifications

I noticed that comment and reply notifications sometimes didn't arrive. At first it looked like a delivery bug, but the real cause was my own rule from P3: both comments and replies only notified people marked Going. So if someone marked an event Interested and asked a question, they never found out when someone answered them. Organizers also didn't hear about comments on their own events unless they had marked them Going, which didn't make sense.

So I changed my earlier decision again. Now a new comment notifies people marked Going and also the organizer, because the organizer is usually the one who should answer questions. A reply only notifies the person whose comment was replied to, no matter how they marked the event. I think that's what people actually expect: if someone answers you, you should know. I stopped sending reply notifications to everyone who is Going, because that would be too many notifications for conversations they're not part of. Nobody gets notified about their own comment or reply.

I still didn't want polling, so the inbox only updates when you open it or come back to the window. Before, there was no way to refresh it manually once it had notifications, and if a dialog was open when you came back, the refresh was skipped completely. I added a Refresh button to the inbox and event pages, and now a skipped refresh runs once the dialog closes.

### Reviewing the whole codebase

After fixing notifications, I reviewed the whole codebase for other mistakes: concepts, server, and frontend. I fixed everything it found.

**Server.** The forms already had character limits, but the server didn't check them, so someone could skip the form and save an event with an empty title or a huge description. I moved the same limits into EventPublishing and Grouping so the server enforces them too (event titles up to 160 characters, locations up to 250, descriptions up to 5000; group names up to 120, descriptions up to 2000). Extra spaces are trimmed. I used the same numbers as the forms so nothing valid in the browser would suddenly be rejected. I also found that Bun closes idle connections after 10 seconds, so slow requests were dropped before the app's own 30-second timeout message could ever show. I raised it to 45 seconds. Also, some valid JPEG pictures were rejected because of two rare marker types, so I fixed the picture check.

**Frontend.** Most of these were small things that made the app feel unreliable:
- If a refresh failed for a moment, for example because of a timeout, the event page used to disappear. Now you stay on the page and see an error. Only a deleted or inaccessible event clears it.
- In one case, saving an edit could publish a second copy of the event. Now saving an edit always updates the event you opened.
- Buttons like Leave, Delete, and Cancel event used to do nothing if their group or event was already gone. Now they say it's no longer available.
- If you sign in as a different account in another tab, the page now clears the old account's drafts and tells you who you're signed in as.
- Pictures used to disappear and reload on every refresh, so I stopped clearing them first.
- Create event is disabled while something else is still saving, and the calendar's "today" moves forward after midnight.

I added tests for all of these, so the suite went from 155 to 164 tests, and all of them pass. I also started using the sync-engine skill to plan each change, get an independent review of the contracts, and record the checks.


### Cleaning up the repository

I had been working on a separate `withVideos` branch, and `main` was missing a lot. I moved the code fixes, the updated user journey, and my design study slides to `main`. I also wrote a README for the slides with a link to the design study video. I didn't want large video files in the repository, so `main` now ignores the whole `Video` folder, along with my local Claude Code files and skill notes.

I also rewrote the main README so someone new can understand the project: what the app does, how to run it, what each folder is for, how the concepts fit together, and how to run the tests. I updated the saved test results so they list all 164 tests.

At one point I accidentally committed my local notes and skill files to `main`. I hadn't pushed yet, so I removed that commit before it reached GitHub. Switching branches had also deleted those files from my folder, so I restored them. Finally, I cloned the repository fresh from GitHub and checked that it installs, passes all checks and tests, and builds.
