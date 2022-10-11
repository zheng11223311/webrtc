// Generate random room name if needed
// 如果需要，请生成随机的房间名称
if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
  }
//   截取1 位字符 # 
  const roomHash = location.hash.substring(1);
//   console.log( location.hash);
//   console.log(roomHash);
  
  // TODO: Replace with your own channel ID
  // 替换为您自己的频道ID
  // const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
  const drone = new ScaleDrone('tHnHBBgAf3ftJT3z');
  // Room name needs to be prefixed with 'observable-'
  // 房间名称需要以“ observable-”作为前缀
  const roomName = 'observable-' + roomHash;
  const configuration = {
    iceServers: [{  //指定ice 的传输策略
      urls: 'stun:stun.l.google.com:19302'  
    }]
  };
  let room;
  let pc;
  
  
  function onSuccess() {};
  function onError(error) {
    console.error(error);
  };
  
  drone.on('open', error => {
    if (error) {
      return console.error(error);
    }
    room = drone.subscribe(roomName);
    room.on('open', error => {
      if (error) {
        onError(error);
      }
    });
    // We're connected to the room and received an array of 'members'
    // connected to the room (including us). Signaling server is ready.
    // 我们连接到这个房间，收到了一组“成员:
    // 连接到该房间（包括我们）。信令服务器已准备就绪。
    room.on('members', members => {
      console.log('MEMBERS', members); //当前所有在线人员
      // If we are the second user to connect to the room we will be creating the offer
      // 如果我们是第二个连接到该房间的用户，我们将创建该 offer
      const isOfferer = members.length === 2;
      startWebRTC(isOfferer);
    });
  });
  
  // Send signaling data via Scaledrone
  // 通过 Scaledrone 发送信号数据
  function sendMessage(message) {
    drone.publish({
      room: roomName,
      message
    });
  }
  
  function startWebRTC(isOfferer) {
    // configuration 远程连接需要设置,局域网内可以不设置
    pc = new RTCPeerConnection(configuration);
  
    // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
    // message to the other peer through the signaling server
    // 当ICE代理需要通过信号服务器向另一个同行发送消息时，“协同处理 onicecandidate ”就会通知我们
    pc.onicecandidate = event => {
      if (event.candidate) {
        sendMessage({'candidate': event.candidate});
      }
    };
  
    // If user is offerer let the 'negotiationneeded' event create the offer
    if (isOfferer) {
      pc.onnegotiationneeded = () => {
        pc.createOffer().then(localDescCreated).catch(onError);
      }
    }
  
    // When a remote stream arrives display it in the #remoteVideo element
    pc.ontrack = event => {
      const stream = event.streams[0];
      if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
        remoteVideo.srcObject = stream;
      }
    };
    
    // 意思是必须使用HTTPS加密通信才能获取getUserMedia()
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    }).then(stream => {
      console.log(stream);
      // Display your local video in #localVideo element
      localVideo.srcObject = stream;
      // Add your stream to be sent to the conneting peer
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }, onError);
  
    // Listen to signaling data from Scaledrone
    room.on('data', (message, client) => {
      // Message was sent by us
      if (client.id === drone.clientId) {
        return;
      }
  
      if (message.sdp) {
        // This is called after receiving an offer or answer from another peer
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
          // When receiving an offer lets answer it
          if (pc.remoteDescription.type === 'offer') {
            pc.createAnswer().then(localDescCreated).catch(onError);
          }
        }, onError);
      } else if (message.candidate) {
        // Add the new ICE candidate to our connections remote description
        pc.addIceCandidate(
          new RTCIceCandidate(message.candidate), onSuccess, onError
        );
      }
    });
  }
  
  function localDescCreated(desc) {
    pc.setLocalDescription(
      desc,
      () => sendMessage({'sdp': pc.localDescription}),
      onError
    );
  }
  