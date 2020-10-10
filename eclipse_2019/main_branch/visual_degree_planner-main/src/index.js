import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import * as firebase from 'firebase';


var firebaseConfig = {
    apiKey: "AIzaSyAL1mJ94GO8tchNCqxBt74GSqByxlZPePM",
    authDomain: "visual-degree-planner.firebaseapp.com",
    databaseURL: "https://visual-degree-planner.firebaseio.com",
    projectId: "visual-degree-planner",
    storageBucket: "visual-degree-planner.appspot.com",
    messagingSenderId: "93575317774",
    appId: "1:93575317774:web:fcc5184c86365e4b366f5f",
    measurementId: "G-LW8BL77RNP"
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
