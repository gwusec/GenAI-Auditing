import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';


const getCurrentUserId = () => {
  return 'user123';
};

const exportedData = [
  {
    "id": "2e741bd6-497a-4dab-8c75-4d6bc9f120bb",
    "startTimestamp": 1736728140426,
    "endTimestamp": 1736728170553,
    "chatEvents": [
      {
        "id": "db4630fa-ba8f-4f87-9f59-c98b6b59c296",
        "type": "new_user_message",
        "timestamp": 1736728148828,
        "data": {
          "id": "b6e0e445-6dfa-42e8-8f4f-accd1c306b79",
          "author": "user",
          "content": "Message 2.1",
          "timestamp": 1736728148828,
          "referencedMessageId": null,
          "isEdited": false
        }
      },
      {
        "id": "51518699-b4ca-466e-bf5a-a64b053b21b6",
        "type": "new_bot_message",
        "timestamp": 1736728149845,
        "data": {
          "id": "bef4967e-d9fb-4968-9c5a-82af89cb97bc",
          "author": "bot",
          "content": "This is a problematic passage.",
          "timestamp": 1736728149845,
          "referencedMessageId": "b6e0e445-6dfa-42e8-8f4f-accd1c306b79",
          "isEdited": false
        }
      },
      {
        "id": "ce26c67f-97b1-45a4-8dbb-0bf4ab171701",
        "type": "end_chat",
        "timestamp": 1736728150626,
        "data": null
      }
    ],
    "audit": {
      "id": "3a460f3d-0a4f-480f-938d-c963181ea9b6",
      "startTimestamp": 1736728140426,
      "endTimestamp": 1736728170553,
      "likertResponses": {
        "problematic": "(1)<br/>Strongly Disagree",
        "questionable": "(5)<br/>Agree<br/><br/>",
        "unfair": "(2)<br/>Disagree<br/><br/>"
      },
      "highlights": [
        {
          "messageId": "bef4967e-d9fb-4968-9c5a-82af89cb97bc",
          "text": "This is a problematic passage.",
          "startIndex": 0
        }
      ],
      "textResponses": {
        "explainProblematic": "Problem, so many problems.",
        "biasesHarms": "Racism."
      }
    },
    "state": "complete"
  },
  {
    "id": "a2f32fda-f156-4969-9014-016aaae5d754",
    "startTimestamp": 1736728089016,
    "endTimestamp": 1736728135292,
    "chatEvents": [
      {
        "id": "38dd528c-a3b2-4371-ae1f-b1659eba5305",
        "type": "new_user_message",
        "timestamp": 1736728095712,
        "data": {
          "id": "bb6e880e-92a8-4cdc-9ac3-9bf7c6dd2cd0",
          "author": "user",
          "content": "Message 1",
          "timestamp": 1736728095712,
          "referencedMessageId": null,
          "isEdited": false
        }
      },
      {
        "id": "b0d0e687-0006-4cce-8212-67136c62bc55",
        "type": "new_bot_message",
        "timestamp": 1736728096746,
        "data": {
          "id": "881d2a2a-9997-4b69-a21f-0db39d39b090",
          "author": "bot",
          "content": "This is a problematic passage.",
          "timestamp": 1736728096746,
          "referencedMessageId": "bb6e880e-92a8-4cdc-9ac3-9bf7c6dd2cd0",
          "isEdited": false
        }
      },
      {
        "id": "b8a571c9-3ff3-42b6-84d8-25572012522c",
        "type": "new_user_message",
        "timestamp": 1736728099428,
        "data": {
          "id": "464e8944-f817-4a47-a3e6-4bcf44cb1e21",
          "author": "user",
          "content": "Message 2",
          "timestamp": 1736728099428,
          "referencedMessageId": null,
          "isEdited": false
        }
      },
      {
        "id": "cd088292-0f14-40ab-a87b-10634cc31688",
        "type": "new_bot_message",
        "timestamp": 1736728100467,
        "data": {
          "id": "b000b1c1-10ed-49f1-9195-0e4bea3555c7",
          "author": "bot",
          "content": "This is a problematic passage.",
          "timestamp": 1736728100467,
          "referencedMessageId": "464e8944-f817-4a47-a3e6-4bcf44cb1e21",
          "isEdited": false
        }
      },
      {
        "id": "d2fea12a-c4e0-474c-aa84-37b3e45d192c",
        "type": "end_chat",
        "timestamp": 1736728101130,
        "data": null
      }
    ],
    "audit": {
      "id": "11afedd8-f149-4e57-afac-6a34a1181edb",
      "startTimestamp": 1736728089016,
      "endTimestamp": 1736728135292,
      "likertResponses": {
        "problematic": "(1)<br/>Strongly Disagree",
        "questionable": "(2)<br/>Disagree<br/><br/>",
        "unfair": "(3)<br/>Somewhat Disagree"
      },
      "highlights": [
        {
          "messageId": "881d2a2a-9997-4b69-a21f-0db39d39b090",
          "text": "problematic",
          "startIndex": 10
        },
        {
          "messageId": "b000b1c1-10ed-49f1-9195-0e4bea3555c7",
          "text": "passage",
          "startIndex": 22
        },
        {
          "messageId": "b000b1c1-10ed-49f1-9195-0e4bea3555c7",
          "text": "This",
          "startIndex": 0
        }
      ],
      "textResponses": {
        "explainProblematic": "Problematic",
        "biasesHarms": "Sexism"
      }
    },
    "state": "complete"
  }
];

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>
    <App
      userId={getCurrentUserId()}
      llmProxyServerUrl={`http://${process.env.REACT_APP_LLM_PROXY_HOST_AND_PORT}`}
      debugMode={true}
      isViewOnly={false}
      viewOnlyData={exportedData} 
      config={{
        timerMaxOverallChatTimeSeconds: [], // time in seconds
        timerChatsMaxSeconds: [,],  // time in seconds; each entry is one chat that MUST be completed
        timerAuditMaxSeconds: [],          // audit: first 1.5 min (90s), second 1 min (60s)
        timerWarningChatTimeIsUpSeconds: [],    // show warning with 2 min left in a chat
        timerMinChatTimeRemainingToStartNewChatSeconds: [] // need at least 3 min left to start a new chat
      }}
    />
  // </React.StrictMode>
);