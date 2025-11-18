# branch-klint Change Log

## `pages` folder

Based on the functionality of the app around AppState, I noticed the site displays certain major parts depending on what stage of auditing the user is on.

I created a "pages" folder to begin the separation of the "pages" of the site.

### Unique props per component (to bring down, mainly for scratch work):

#### Audit Page (hell)

- handleAuditComplete v
- handleTutorialComplete v

#### Chat Page

- timerSystem v

#### CompletePage

- showAfterChatOneDialog v
- handleCloseChatOneDialog v
- showAfterChatTwoDialogNoTime v
- handleCloseChatTwoDialogNoTime v
- showAfterChatTwoDialogWithTime v
- handleCloseChatTwoDialogWithTime v

#### SurveyPage

- debugMode v

## `layout` folder

I eventually removed any form of page layout (returned xml) from the files in the `pages` folder. I created a `layouts` folder that contains the layouts per each page. The files in `pages` are meant to contain business logic for the page while separating layout as a different concern. 

## Component folder structure change

Grouped component code with style. Not really a large change, but worth bringing up.

# Call/Meet Notes

## Tues. Nov. 4 Notes

1. Inference Agent
2. Config System
3. Chatbot
4. Audit 
5. Dashboard

## Wed. Nov 12 Notes

Audit: 
- Separate for more customizability
- Determine own model

TIMER FEATURE
Different evaluation strategies
More types of questions
Annotations 

**LOOK UP SURVEY.JS**

Make dashboard more "interesting"
- Number of problems found
- Kinds of problems found

## Thurs Nov 13 

- Light LLM - look into thsi later
- modularized

