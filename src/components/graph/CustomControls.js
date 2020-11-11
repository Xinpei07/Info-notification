import React, {memo} from 'react';
import {useStoreActions, useStoreState} from "react-flow-renderer";
import {
  DeleteOutlined,
  ExpandOutlined,
  InfoCircleOutlined,
  LockOutlined,
  MinusOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ShareAltOutlined,
  UnlockOutlined
} from "@ant-design/icons";
import ReactTooltip from "react-tooltip";
import 'antd/dist/antd.css';
import * as firebase from 'firebase';
import {Graph,selected,selectedSubjects} from "../Graph";
import { Button, notification, Tooltip } from 'antd';
import App from '../../App';
import {selectedCourse} from "../TermTable"
import {getCourse} from "../GraphData"


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
var ref = firebase.database().ref();
const CustomControls = ({
                    style,
                    showZoom = true,
                    showFitView = true,
                    showInteractive = false,
                    onZoomIn,
                    onZoomOut,
                    onFitView,
                    onInteractiveChange,
                    className,
                    // Custom controls
                    showCourseInfo = true,
                    showClearSelection = true,
                    showStickyHighlights = false,
                    onShowCourseInfo,
                    onClearSelection,
                    onStickyHighlights,
                    isStickyHighlights,
                  }) => {
  const setInteractive = useStoreActions((actions) => actions.setInteractive);
  const fitView = useStoreActions((actions) => actions.fitView);
  const zoomIn = useStoreActions((actions) => actions.zoomIn);
  const zoomOut = useStoreActions((actions) => actions.zoomOut);

  const isInteractive = useStoreState((s) => s.nodesDraggable && s.nodesConnectable && s.elementsSelectable);
  const mapClasses = 'react-flow__controls' + ( className !== undefined ? " " + className : "" );

  return (
    <div className={mapClasses} style={style}>
      {showZoom && (
        <>
          <div
            data-tip={true} data-for="zoomInTip"
            className="react-flow__controls-button react-flow__controls-zoomin"
            onClick={() => {
              zoomIn();
              if (onZoomIn) {
                onZoomIn();
              }
            }}
          >
            <PlusOutlined />
          </div>
          <ReactTooltip id="zoomInTip" place="top" effect="solid">
            Zoom In
          </ReactTooltip>
          <div
            data-tip={true} data-for="zoomOutTip"
            className="react-flow__controls-button react-flow__controls-zoomout"
            onClick={() => {
              zoomOut();
              if (onZoomOut) {
                onZoomOut();
              }
            }}
          >
            <MinusOutlined />
          </div>
          <ReactTooltip id="zoomOutTip" place="top" effect="solid">
            Zoom In
          </ReactTooltip>
        </>
      )}
      {showFitView && (
        <>
          <div
            data-tip={true} data-for="fitViewTip"
            className="react-flow__controls-button react-flow__controls-fitview"
            onClick={() => {
              fitView({ padding: 0.1 });
              if (onFitView) {
                onFitView();
              }
            }}
          >
            <ExpandOutlined />
          </div>
          <ReactTooltip id="fitViewTip" place="top" effect="solid">
            Fit to View
          </ReactTooltip>
        </>
      )}
      {showInteractive && (
        <>
          <div
            data-tip={true} data-for="interactiveTip"
            className="react-flow__controls-button react-flow__controls-interactive"
            onClick={() => {
              setInteractive(!isInteractive);
              if (onInteractiveChange) {
                onInteractiveChange(!isInteractive);
              }
            }}
          >
            {isInteractive ? <UnlockOutlined /> : <LockOutlined />}
          </div>
          <ReactTooltip id="interactiveTip" place="top" effect="solid">
            Enable/Disable Interactive Graph
          </ReactTooltip>
        </>
      )}
      {showStickyHighlights && (
        <>
          <div
            data-tip={true} data-for="stickyHighlightsTip"
            className="react-flow__controls-button react-flow__controls-stickyhighlights"
            onClick={() => {
              if (onStickyHighlights) {
                onStickyHighlights();
              }
            }}
          >
            { isStickyHighlights ? <ShareAltOutlined /> : <NodeIndexOutlined /> }
          </div>
          <ReactTooltip id="stickyHighlightsTip" place="top" effect="solid">
            Keep/Hide Recent Edges
          </ReactTooltip>
        </>
      )}
      {showCourseInfo && (
        <>
          <div
            data-tip={true} data-for="courseInfoTip"
            className="react-flow__controls-button react-flow__controls-info"
            onClick={(data) => {
              //if (onShowInfo) {
              //}
              //let dependency = selected;
              //console.log(selected);
              let preList=[];
              let integrateRepeat=[];
              let integrate=[];
              for(var j=0;j<selectedCourse.length;j++){
                //console.log("for loop happy",selectedCourse[j]);
                preList=getCourse(selectedCourse[j],selectedSubjects).prereq
                preList.toString().split(",");
                console.log("testYYY",preList[0]);
                for(var i=0;i<preList[0].length;i++){
                  integrateRepeat.push(preList[0][i]); //get all the pre-req courses for selected courses
                }
              }
              console.log("testUUU",integrateRepeat);
              for(var i=0;i<integrateRepeat.length;i++){
                if(!integrate.includes(integrateRepeat[i])){
                  integrate.push(integrateRepeat[i]); //integrate: pre-req list for selected courses without repeat course
                }
              }
              //console.log("test---------",integrate);
              //console.log("testT",selectedSubjects);
              let  course=integrate;
              let dependency = (course.toString()).split(",");
              var len = dependency.length;
              var str_cond;
              let graph = [];
              var id = data.label;
              ref.on("value", function(snapshot) {
              //snapshot.forEach((child) => {
              for(var i=0;i<160;i++){
                  var ref1 = firebase.database().ref("Subject Area/"+i+"/course");
                  ref1.on("value", function(snapshot) {
                      snapshot.forEach((child) => {
                          for(var k=0;k<len;k++){
                            //console.log(course[k]);
                            //console.log("depen",dependency[0]);
                              if(dependency[k]===child.key){
                                
                                  console.log("push",dependency[k]);
                                  graph.push(dependency[k]);
                                  graph.push(" : ");
                                  graph.push(child.val().conditions);
                                  graph.push(<br/>);
                                  graph.push(<br/>);
                                  //alert("searching",graph);
                              }
                          }
                  });
              }//, function (error) {
              //console.log("Error: " + error.code);
          //}
              );
          }
        
            notification.open({
              
              duration:8,
              top:70,
              message: ' Pre-req List',
              description:
                graph,
              onClick: () => {
                console.log('Notification Clicked!');
              },
              style: {
                width: 650,
                overflowY:"scroll",
                height:200
              },
              
            });
     
        }, function (error) {
          console.log("Error: " + error.code);
        });
        
              
      
            }}
          >
            <InfoCircleOutlined />
          </div>
          <ReactTooltip id="courseInfoTip" place="top" effect="solid">
            Show Requirements for Selected
          </ReactTooltip>
        </>
      )}
      {showClearSelection && (
        <>
          <div style={{borderBottom: "5px solid #eee"}}/>
          <div
            data-tip={true} data-for="clearSelectionTip"
            className="react-flow__controls-button react-flow__controls-clearselection"
            onClick={() => {
              if (onClearSelection) {
                onClearSelection();
              }
            }}
          >
            <DeleteOutlined />
          </div>
          <ReactTooltip id="clearSelectionTip" place="top" effect="solid">
            Clear Selection
          </ReactTooltip>
        </>
      )}
    </div>
  );
};

export default memo(CustomControls);
