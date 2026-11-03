# InfiniteWeek — User Study Task List

| Task | Instructions for the User | Rationale |
|---|---|---|
| **1. Create an Account (3 min)** | Create an account using a username and password of your choice. | Tests whether the registration process is intuitive and whether users understand the password requirements and feedback. |
| **2. Explore and Join Groups (5 min)** | Browse the available groups and join a few that interest you, including both open groups and groups that require approval. | Tests whether users can discover groups and understand the difference between open and approval-only membership. We want to see whether the joining process is clear without guidance. |
| **3. Check Group Membership (4 min)** | You have requested to join a group that requires approval. Check the status of your request. Once your request has been approved, verify that you are now a member of the group. | Tests whether users understand the membership approval process and can recognize changes in their membership status. We want to observe whether the interface communicates these changes clearly. |
| **4. Discover and Save Events (5 min)** | Explore upcoming events, find one that interests you, and mark yourself as `INTERESTED`. | Tests whether users can discover events, understand their details, and save them. We want to observe how users naturally navigate the event discovery interface. |
| **5. Interact with an Event (3 min)** | Find an event and leave a comment on it. | Tests whether users can find and use event interaction features and understand where their comments appear. |
| **6. View Your Calendar (4 min)** | Find your personal calendar and review the events you have saved. | Tests whether users understand how saved events are organized and whether they can easily locate their personal schedule. |
| **7. Publish an Event (9 min)** | Imagine you're organizing an event for a group you belong to. Create and publish an event with a title, description, date, time, and location. Optionally, add an image to your event. | Tests whether users can independently create an event and understand how events are associated with groups. We also want to observe whether the image upload process is intuitive. |
| **8. Manage Your Plans (7 min)** | Explore more events and add them to your calendar. Find an event you previously marked as `INTERESTED` and change your response to `GOING`. Then, remove another event from your calendar because you no longer plan to attend. | Tests whether users understand the difference between attendance responses and can update their plans. We want to see whether these changes are reflected clearly in the calendar and whether navigation between Explore and My Events is intuitive. |

**Total estimated duration: 40 minutes**

## Post-Test Questions

1. What, if anything, felt confusing while using the app?
2. Was there anything you expected to be able to do but couldn't?
3. What would you change or improve about the app?
4. Was the relationship between groups and events clear?
5. Did you understand the difference between `INTERESTED` and `GOING`?
6. Do you think this app would be useful for keeping track of MIT events?

## Testing Approach

Participants were asked to complete the tasks independently while explaining their thoughts and expectations. We observed their navigation choices, hesitation, mistakes, and whether they needed assistance. After completing the tasks, we asked follow-up questions to understand their experiences and identify possible improvements.

The tasks cover the main concepts of InfiniteWeek: group membership and approval, event discovery, event publishing, commenting, and personal event management. They are designed to reveal difficulties in both the gulf of execution (figuring out how to perform an action) and the gulf of evaluation (understanding the results of an action).

Participant 1, Tamar:

## User Study 1 (Tamar)

Tamar completed almost all tasks without difficulty, including creating an account, joining groups, saving events, commenting, publishing an event, and managing her calendar. She really liked the design and described it as funny and engaging. She also said she would definitely use the app to keep track of MIT events.

One interesting observation was how Tamar navigated to discover events. Whenever I asked her to explore events, she first went to **My Events** and then clicked **Explore Events** from the empty calendar view. This suggests that she naturally associated finding events with her personal calendar rather than the separate Explore page. Although she successfully completed the tasks, this revealed a small gulf of execution because the navigation did not fully match her expectations.

When I asked what she would improve, Tamar suggested adding filters to distinguish open groups from groups requiring approval or with pending membership requests. She otherwise found the interface straightforward and understood the difference between `INTERESTED` and `GOING`.

Her main confusion concerned the relationship between groups and events. She asked whether every event had to belong to a group and how someone could publish an event visible to everyone. After I explained the campus-wide MIT Campus group, she suggested automatically joining new users to it and allowing users to choose whether to publish events as themselves or on behalf of a group.

Overall, Tamar found the app intuitive, useful, and visually engaging. Her feedback highlighted opportunities to improve event discovery, group filtering, and the clarity of event publishing.

## User Study 2 (Senthan)

Senthan completed all tasks without much difficulty, including creating an account, joining groups, discovering and saving events, commenting, publishing an event, and managing his calendar. He said that everything was clearly labeled and that he didn't find the app confusing. He also really liked the app and said he would definitely use it if it were available. He even mentioned that he wished it was already launched.

One interesting thing I noticed was that, just like the first participant, Senthan initially went to My Events when I asked him to discover events, instead of going directly to Explore. During the questions at the end, he pointed out that when My Events is empty, there is an option to explore events, but once you add an event, that option disappears. He thought this was inconsistent and could confuse users about the difference between My Events and Explore. This showed a gulf of execution because the navigation didn't match what he expected.

Another issue was that he saved an event that had already passed. He only realized this after opening his calendar, which suggests that the event date wasn't obvious enough when browsing. I realized that I should prevent past events from appearing in the Explore feed.

Besides these issues, Senthan understood everything else pretty well. He understood how groups worked, why events needed to belong to a group, and correctly explained the difference between INTERESTED and GOING.

Overall, Senthan found the app easy to use and said he would definitely use it. His feedback helped me identify improvements for event discovery and navigation.


## Flaws and Opportunities for Improvement


### 1. Confusing Navigation Between My Events and Explore
- **Level:** Linguistic and Physical
- **Severity:** Moderate

Both Tamar and Senthan initially went to **My Events** when I asked them to discover events, instead of going directly to Explore. The label "My Events" suggests that it is where events can be found, which is a linguistic issue. Senthan also pointed out that when My Events is empty, there is a button to explore events, but this button disappears once events are added. This is a physical issue, because the control is no longer there when users need it, and it makes navigation inconsistent and can confuse users about the purpose of each page.

**Possible improvement:** Keep the Explore Events button visible in My Events at all times and make the distinction between the two pages clearer, for example by renaming My Events to something like "My Plans".

### 2. Past Events Appearing in Explore
- **Level:** Conceptual and Physical
- **Severity:** Moderate

Both participants encountered events that had already passed. Senthan even saved one without realizing it was in the past until he checked his calendar. This happens because the Explore feed currently doesn't filter out old events and lists them first, making it harder for users to find events they can actually attend. This is a conceptual issue, because users expect Explore to show events they can still go to. It is also a physical issue, because the date on event cards is easy to miss.

**Possible improvement:** Only show upcoming events in Explore by default, optionally provide a separate section for past events, and make the date more prominent on event cards.

### 3. Difficulty Finding Groups by Membership Status
- **Level:** Physical
- **Severity:** Minor

During the debriefing, Tamar suggested adding filters for open groups and groups with pending membership requests. The Groups page already separates "Your groups" from "Explore groups", and each card shows a badge such as "Open to join", "Approval required", or "Request pending". However, all groups that a user hasn't joined appear together in one list, so users have to browse through them to find groups they can immediately join or check their request status.

**Possible improvement:** Add filters within Explore groups for open groups, approval-only groups, and pending requests.

### 4. Unclear Relationship Between Groups and Events
- **Level:** Conceptual
- **Severity:** Moderate

Tamar was confused about whether every event had to belong to a group and how she could publish an event visible to everyone. Currently, all events must belong to a group, and users need to join the MIT Campus group to publish campus-wide events. This wasn't immediately obvious to her.

**Possible improvement:** Automatically add new users to MIT Campus and make the difference between public and group-only events clearer. Another idea Tamar suggested was allowing users to choose whether to publish an event as themselves or on behalf of a group.
