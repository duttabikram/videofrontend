import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./Meet.css";

const socket = io("https://videobackend-llpa.onrender.com");

function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const chatEndRef = useRef(null);

  const roomId = "test-room";

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    init();

    socket.on("chat-message", (data) => {
      console.log("📩 Chat received:", data);
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("chat-message");
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function init() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localVideoRef.current.srcObject = stream;

    peerRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getTracks().forEach((track) =>
      peerRef.current.addTrack(track, stream)
    );

    peerRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    socket.emit("join-room", roomId);

    socket.on("user-joined", async () => {
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    });

    socket.on("offer", async (offer) => {
      await peerRef.current.setRemoteDescription(offer);
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async (answer) => {
      await peerRef.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.error(err);
      }
    });
  }

  function toggleMute() {
    const audioTrack =
      localVideoRef.current.srcObject.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }

  function toggleCamera() {
    const videoTrack =
      localVideoRef.current.srcObject.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOff(!videoTrack.enabled);
  }

function leaveCall() {
  // Stop local media
  if (localVideoRef.current?.srcObject) {
    localVideoRef.current.srcObject
      .getTracks()
      .forEach(track => track.stop());
  }

  // Close peer connection
  if (peerRef.current) {
    peerRef.current.close();
    peerRef.current = null;
  }

  // Clear video elements
  if (localVideoRef.current) {
    localVideoRef.current.srcObject = null;
  }

  if (remoteVideoRef.current) {
    remoteVideoRef.current.srcObject = null;
  }

  // Disconnect socket
  if (socket.connected) {
    socket.disconnect();
  }
}


  function sendMessage() {
    if (!message.trim()) return;

    console.log("📤 Sending chat:", message);

    socket.emit("chat-message", {
      roomId,
      message,
      sender: socket.id,
    });

    setMessages((prev) => [
      ...prev,
      { sender: socket.id, message },
    ]);

    setMessage("");
  }

  const controlBtn = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "none",
  background: "#1976d2",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "500",
};

  return (
<div
  style={{
    display: "flex",
    height: "100vh",
    padding: "24px",
    gap: "24px",
    background: "#f4f6f8",
    fontFamily: "Inter, sans-serif",
  }}
>
  {/* LEFT SIDE – VIDEO */}
  <div
    style={{
      flex: 3,
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}
  >
    <h2 style={{ marginBottom: "16px" }}>Google Meet Clone</h2>

    <div
      style={{
        display: "flex",
        gap: "16px",
        marginBottom: "20px",
      }}
    >
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        style={{
          width: "320px",
          height: "200px",
          borderRadius: "10px",
          background: "#000",
        }}
      />

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: "320px",
          height: "200px",
          borderRadius: "10px",
          background: "#000",
        }}
      />
    </div>

    {/* CONTROLS */}
    <div
      style={{
        display: "flex",
        gap: "12px",
      }}
    >
      <button style={controlBtn} onClick={toggleCamera}>
        {isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
      </button>

      <button style={controlBtn} onClick={toggleMute}>
        {isMuted ? "Unmute" : "Mute"}
      </button>

      <button
        onClick={leaveCall}
        style={{
          ...controlBtn,
          background: "#e53935",
          color: "#fff",
        }}
      >
        Leave Call
      </button>
    </div>
  </div>

  {/* RIGHT SIDE – CHAT */}
  <div
    style={{
      flex: 1.5,
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <h4 style={{ marginBottom: "10px" }}>Chat</h4>

    <div
      style={{
        flex: 1,
        overflowY: "auto",
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "10px",
        marginBottom: "10px",
      }}
    >
      {messages.map((msg, i) => (
        <div
          key={i}
          style={{
            marginBottom: "6px",
            textAlign: msg.sender === socket.id ? "right" : "left",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "6px 10px",
              borderRadius: "8px",
              background:
                msg.sender === socket.id ? "#1976d2" : "#eeeeee",
              color: msg.sender === socket.id ? "#fff" : "#000",
            }}
          >
            {msg.message}
          </span>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>

    <div style={{ display: "flex", gap: "8px" }}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Type a message..."
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #ccc",
        }}
      />
      <button style={controlBtn} onClick={sendMessage}>
        Send
      </button>
    </div>
  </div>
</div>
  );
}

export default App;
