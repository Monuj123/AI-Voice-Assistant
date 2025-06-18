import "./App.css";
import { useRef, useState, useEffect } from "react";
import speech, { useSpeechRecognition } from "react-speech-recognition";
import { Mic, Send, StopCircle, Loader2 } from "lucide-react";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { token } from "./config.js";

const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

function App() {
  const speechSynthesisRef = useRef(null);
  const conversationEndRef = useRef(null);
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  async function callGPTApi(message) {
    setThinking(true);
    setError(null);

    try {
      setConversation((prev) => [...prev, { role: "user", content: message }]);

      const client = ModelClient(endpoint, new AzureKeyCredential(token));

      const response = await client.path("/chat/completions").post({
        body: {
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant. Provide clear, concise answers in short paragraphs.",
            },
            { role: "user", content: message },
          ],
          temperature: 0.7,
          top_p: 1,
          model: model,
        },
      });

      if (isUnexpected(response)) {
        throw response.body.error;
      }

      if (response.body.choices[0].message.content) {
        const aiResponse = response.body.choices[0].message.content;
        setConversation((prev) => [
          ...prev,
          { role: "ai", content: aiResponse },
        ]);
        return aiResponse;
      }
      throw new Error("No response from API");
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    if (transcript && !listening) {
      callGPTApi(transcript).then((response) => {
        if (response) {
          const utterance = new SpeechSynthesisUtterance(response);
          setIsSpeaking(true);
          utterance.onend = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        }
      });
    }
  }, [transcript, listening]);

  return (
    <div className="container">
      <header className="header">
        <h1>AI Voice Assistant</h1>
      </header>

      <div className="conversation">
        {conversation.length === 0 ? (
          <div className="welcome">
            <div className="logo">AI</div>
            <h2>How can I help you today?</h2>
            <p>Press the microphone button and speak your question</p>
          </div>
        ) : (
          conversation.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.role === "user" ? "user-message" : "ai-message"
              }`}
            >
              <div className="message-avatar">
                {msg.role === "user" ? "You" : "AI"}
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
        )}
        {thinking && (
          <div className="message ai-message">
            <div className="message-avatar">AI</div>
            <div className="message-content">
              <Loader2 className="thinking-spinner" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={conversationEndRef} />
      </div>

      <div className="input-area">
        <div className="input-container">
          {transcript && (
            <div className="transcript">
              <p>{transcript}</p>
            </div>
          )}
          <div className="controls">
            <button
              className={`mic-button ${listening ? "active" : ""}`}
              onClick={listening ? speech.stopListening : speech.startListening}
              disabled={thinking}
            >
              {listening ? <StopCircle size={24} /> : <Mic size={24} />}
            </button>
            {isSpeaking && (
              <button className="stop-speaking" onClick={stopSpeaking}>
                <StopCircle size={24} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export default App;
