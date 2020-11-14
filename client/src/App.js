import React, { useEffect, useState, useRef, Suspense } from 'react';
import io from "socket.io-client";
import Peer from "simple-peer";
import Rodal from 'rodal'
import {Howl} from 'howler'

import  'rodal/lib/rodal.css'
import './index.css';

import camera from './Icons/camera.svg'
import camerastop from './Icons/camera-stop.svg'
import microphone from './Icons/microphone.svg'
import microphonestop from './Icons/microphone-stop.svg'
import hangup from './Icons/hang-up.svg'
import fullscreen from './Icons/fullscreen.svg'
import minimize from './Icons/minimize.svg'
import ringtone from './Sounds/ringtone.mp3'

const ringtoneSound = new Howl({
  src: [ringtone],
  loop: true,
  preload: true
})

function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callingFriend, setCallingFriend] = useState(false);
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callRejected, setCallRejected] = useState(false);
  const [receiverID, setReceiverID] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [audioMuted, setAudioMuted] = useState(false)
  const [videoMuted, setVideoMuted] = useState(false)
  const [isfullscreen, setFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const userVideo = useRef();
  const partnerVideo = useRef();
  const socket = useRef();
  const myPeer=useRef();

  let Landing = () => {return(
    <main>
        <div>
            <div className="actionText">Who do you want to call, <span>{yourID}</span>?</div>
        </div>
        <div>
            <input type="text" placeholder="Friend ID" value={receiverID} onChange={e => setReceiverID(e.target.value)}/>
            <button onClick={() => callPeer(receiverID.toLowerCase().trim())}>Call</button>
        </div>
    </main>
  )}

  useEffect(() => {
    socket.current = io.connect("/");
    

    socket.current.on("yourID", (id) => {
      setYourID(id);
    })
    socket.current.on("allUsers", (users) => {
      setUsers(users);
    })

    socket.current.on("hey", (data) => {
      setReceivingCall(true);
      ringtoneSound.play();
      setCaller(data.from);
      setCallerSignal(data.signal);
    })
  }, []);

  function callPeer(id) {
    if(id!=='' && users[id] && id!==yourID){
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
        setStream(stream);
        setCallingFriend(true)
        setCaller(id)
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        }
        const peer = new Peer({
          initiator: true,
          trickle: false,
          config: {
    
            iceServers: [
                {
                    urls: "stun:numb.viagenie.ca",
                    username: "sultan1640@gmail.com",
                    credential: "98376683"
                },
                {
                    urls: "turn:numb.viagenie.ca",
                    username: "sultan1640@gmail.com",
                    credential: "98376683"
                }
            ]
        },
          stream: stream,
        });

        myPeer.current=peer;
    
        peer.on("signal", data => {
          socket.current.emit("callUser", { userToCall: id, signalData: data, from: yourID })
        })
    
        peer.on("stream", stream => {
          if (partnerVideo.current) {
            partnerVideo.current.srcObject = stream;
          }
        });

        peer.on('error', (err)=>{
          endCall()
        })
    
        socket.current.on("callAccepted", signal => {
          setCallAccepted(true);
          peer.signal(signal);
        })

        socket.current.on('close', ()=>{
          window.location.reload()
        })
  
        socket.current.on('rejected', ()=>{
          window.location.reload()
        })
      })
      .catch(()=>{
        setModalMessage('You cannot place/ receive a call without granting video and audio permissions! Please change your settings to use Cuckoo.')
        setModalVisible(true)
      })
    } else {
      setModalMessage('We think the username entered is wrong. Please check again and retry!')
      setModalVisible(true)
      return
    }
  }

  function acceptCall() {
    ringtoneSound.unload();
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setStream(stream);
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
      setCallAccepted(true);
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: stream,
      });

      myPeer.current=peer

      peer.on("signal", data => {
        socket.current.emit("acceptCall", { signal: data, to: caller })
      })

      peer.on("stream", stream => {
        partnerVideo.current.srcObject = stream;
      });

      peer.on('error', (err)=>{
        endCall()
      })

      peer.signal(callerSignal);

      socket.current.on('close', ()=>{
        window.location.reload()
      })
    })
    .catch(()=>{
      setModalMessage('You cannot place/ receive a call without granting video and audio permissions! Please change your settings to use Cuckoo.')
      setModalVisible(true)
    })
  }

  function rejectCall(){
    ringtoneSound.unload();
    setCallRejected(true)
    socket.current.emit('rejected', {to:caller})
    window.location.reload()
  }

  function endCall(){
    myPeer.current.destroy()
    socket.current.emit('close',{to:caller})
    window.location.reload()
  }

  function toggleMuteAudio(){
    if(stream){
      setAudioMuted(!audioMuted)
      stream.getAudioTracks()[0].enabled = audioMuted
    }
  }

  function toggleMuteVideo(){
    if(stream){
      setVideoMuted(!videoMuted)
      stream.getVideoTracks()[0].enabled = videoMuted
    }
  }
  let UserVideo;
  if (stream) {
    UserVideo = (
      <video className="userVideo" playsInline muted ref={userVideo} autoPlay />
    );
  }

  let PartnerVideo;
  if (callAccepted && isfullscreen) {
    PartnerVideo = (
      <video className="partnerVideo cover" playsInline ref={partnerVideo} autoPlay />
    );
  } else if (callAccepted && !isfullscreen){
    PartnerVideo = (
      <video className="partnerVideo" playsInline ref={partnerVideo} autoPlay />
    );
  }

  let incomingCall;
  if (receivingCall && !callAccepted && !callRejected) {
    incomingCall = (
      <div className="incomingCallContainer">
        <div className="incomingCall flex flex-column">
          <div><span className="callerID">{caller}</span> is calling you!</div>
          <div className="incomingCallButtons flex">
          <button name="accept" className="alertButtonPrimary" onClick={()=>acceptCall()}>Accept</button>
          <button name="reject" className="alertButtonSecondary" onClick={()=>rejectCall()}>Reject</button>
          </div>
        </div>
      </div>
    )
  }

  let audioControl;
  if(audioMuted){
    audioControl=<span className="iconContainer" onClick={()=>toggleMuteAudio()}>
      <img src={microphonestop} alt="Unmute audio"/>
    </span>
  } else {
    audioControl=<span className="iconContainer" onClick={()=>toggleMuteAudio()}>
      <img src={microphone} alt="Mute audio"/>
    </span>
  }

  let videoControl;
  if(videoMuted){
    videoControl=<span className="iconContainer" onClick={()=>toggleMuteVideo()}>
      <img src={camerastop} alt="Resume video"/>
    </span>
  } else {
    videoControl=<span className="iconContainer" onClick={()=>toggleMuteVideo()}>
      <img src={camera} alt="Stop audio"/>
    </span>
  }

  let hangUp=<span className="iconContainer" onClick={()=>endCall()}>
    <img src={hangup} alt="End call"/>
  </span>

  let fullscreenButton;  
  if(isfullscreen){
    fullscreenButton=<span className="iconContainer" onClick={()=>{setFullscreen(false)}}>
      <img src={minimize} alt="fullscreen"/>
    </span>
  } else {
    fullscreenButton=<span className="iconContainer" onClick={()=>{setFullscreen(true)}}>
      <img src={fullscreen} alt="fullscreen"/>
    </span>
  }

  return (
    <div>
      <div>
        <Landing/>

        <Rodal 
          visible={modalVisible} 
          onClose={()=>setModalVisible(false)} 
          width={20} 
          height={5} 
          measure={'em'}
          closeOnEsc={true}
        >
        <div>{modalMessage}</div>
        </Rodal>
        {incomingCall}

      </div>
      <div className="callContainer">
        <Suspense fallback={<div>Loading...</div>}></Suspense>
        <div className="partnerVideoContainer">
          {PartnerVideo}
        </div>
        <div className="userVideoContainer">
          {UserVideo}
        </div>
        <div className="controlsContainer">
          {audioControl}
          {videoControl}
          {fullscreenButton}
          {hangUp}
        </div>
      </div>
    </div>
  );
}

export default App;