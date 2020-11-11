import React from 'react';
import ReactFlow, {isEdge, isNode, ReactFlowProvider} from 'react-flow-renderer';
import {cloneDeep} from "lodash";
import {connect} from 'react-redux';
import {assignSelection} from "../redux/actions"
import {
  filterForGraph,
  findDependentSelectedCourses,
  findDependentSelectedCoursesForSubjectArea,
  generateGraphElements,
  getCourse,
} from './GraphData';
import {
  addToMappedList,
  appendCSSClass,
  arrayIntersection,
  arrayRemoveShallow,
  arraysAreEqual,
  removeCSSClass
} from "./GraphUtil";
import GraphProvider from "./GraphProvider";
import SoloNode from "./SoloNode";
import CustomBackground from "./graph/CustomBackground";
import CustomControls from "./graph/CustomControls";
import './Graph.css';
import {Controls,NodeProps, Position, Handle} from 'react-flow-renderer';
import './Graph.css'
import memoizeOne from "memoize-one";
import { render } from 'react-dom';
import 'antd/dist/antd.css';
import { Button, notification, Tooltip } from 'antd';
import { BulbOutlined,InfoOutlined, BookOutlined, CalendarOutlined, WarningOutlined } from '@ant-design/icons';
import * as firebase from 'firebase';
import './SoloNode.css';
import {selectedCourse} from "./TermTable"

const DEBUG_OUTPUT = false;
export let selected=[];
export let selectedSubjects=[];
var ref = firebase.database().ref();

export class Graph extends React.Component {
  constructor(props) {
    super(props);
    const {elements, nodeMaxCoords} = generateGraphElements(props.selectedSubjects);
    this.state = {
      graphElements: elements,
      nodeMaxCoords: nodeMaxCoords,
      selectedCourses: [],
      forkedDependencies: {},
      forceProviderSelectionUpdate: false,
      stickyHighlights: false
    };
  }

  setGraphState = (newState) => {
    // console.log("[setGraphState] newState: ", newState);
    this.setState(newState);
    if ('selectedCourses' in newState) {
      this.props.assignSelection(newState.selectedCourses);
    }
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (DEBUG_OUTPUT) if (DEBUG_OUTPUT) console.log("componentDidUpdate...");
    if (prevProps.selectedSubjects !== this.props.selectedSubjects) {
      this.handleChangedSubjectAreas(prevProps);
    }
  }

  handleChangedSubjectAreas(prevProps) {
    if (DEBUG_OUTPUT) console.log("[handleChangedSubjectAreas] Different props: ", prevProps.selectedSubjects, " vs ", this.props.selectedSubjects);

    // Generate the graph with the new subject areas
    const {elements, nodeMaxCoords} = generateGraphElements(this.props.selectedSubjects);

    // Updated selectedCourses and forkedDependencies based on the new data
    let newSelected;
    let newForked;
    let forceProviderSelectionUpdate;

    // Remove any subject areas from selectedCourses and forkedDependencies
    const removedSubjects = prevProps.selectedSubjects.filter(x => !this.props.selectedSubjects.includes(x));
    const removedSelected = this.state.selectedCourses.filter(courseCode => removedSubjects.includes(courseCode.substring(0,4)));
    if (DEBUG_OUTPUT) console.log("[handleChangedSubjectAreas] Removed subjects: ", removedSubjects, " Removed selected: ", removedSelected);
    if (removedSelected.length > 0) {
      ({ selectedCourses: newSelected, forkedDependencies: newForked, forceProviderSelectionUpdate } = this.removeSelectedCourses(removedSelected));
    }

    // Update forkedDependencies to account for any new courses (potential prereqs)
    const addedSubjects = this.props.selectedSubjects.filter(x => !prevProps.selectedSubjects.includes(x));
    if (DEBUG_OUTPUT) console.log("[handleChangedSubjectAreas] Added subjects: ", addedSubjects);
    if (addedSubjects.length > 0) {
      let updatedForkedDeps = cloneDeep(this.state.forkedDependencies);
      for (const addedSubject of addedSubjects) {
        const dependents = findDependentSelectedCoursesForSubjectArea(this.state.selectedCourses, addedSubject, this.props.selectedSubjects);
        this.deepMergeIntoForkedDependencies(updatedForkedDeps, dependents);
        this.pruneForkedDependencies(updatedForkedDeps, this.state.selectedCourses);
      }
      newForked = updatedForkedDeps;
    }

    this.updateCSSForkedCourses(elements, (newForked !== undefined ? newForked : this.state.forkedDependencies));
    this.updateAnimatedEdges(elements,
      (newSelected !== undefined ? newSelected : this.state.selectedCourses),
      (newForked !== undefined ? newForked : this.state.forkedDependencies));

    this.setGraphState({
      graphElements: elements,
      nodeMaxCoords: nodeMaxCoords,
      ...(newSelected !== undefined) && { selectedCourses: newSelected },
      ...(newForked !== undefined) && { forkedDependencies: newForked },
      ...(forceProviderSelectionUpdate !== undefined) && { forceProviderSelectionUpdate: forceProviderSelectionUpdate }
    });
  }

  /**
   * Handle selection changes from the graph.
   * @param elements    list of selected react-flow elements
   *
   * Selection changes happen from three places:
   *   1) Selection weirdness during initial render (set to null and empty and stuff)
   *   2) User clicks on a node
   *   3) 'Loopback' from manually updating the selection in GraphProvider (thus selectionChange)
   * We want to try and ignore any 'loopbacks' and only update on user clicks
   *
   * There are three situations currently handled:
   *   1) elements is null or empty
   *       - This usually indicates that the user has clicked off the graph, emptying the selection
   *       - Action: reset the selection back to the current state.selectedCourses
   *   2) elements = 1
   *       - This should only occur through user selection
   *       - Action: check if element is already selected and add/remove accordingly
   *       - NOTE: if users can manually select multiple courses then this logic will be broken
   *   3) forceProviderSelectionUpdate is true
   *       - forceProviderSelectionUpdate = true will always update in GraphProvider and thus always trigger loopback
   *       - Action: catch the loopback and reset forceProviderSelectionUpdate
   *       - This is for GraphProvider to actually trigger on single element arrays
   *       - and to catch/ignore the loopback of a single element so it doesn't look like a user click
   */
  onSelectionChange(elements) {
    if (DEBUG_OUTPUT) console.log("[Graph] On Selection change: ", elements);

    // If forceProviderSelectionUpdate is true then setSelected will always be called
    // and so there will always be a loopback onSelectionChange()
    if (this.state.forceProviderSelectionUpdate) {
      if (DEBUG_OUTPUT) console.log("[Graph] Resetting forceProviderSelectionUpdate...");
      this.setGraphState({
        forceProviderSelectionUpdate: false
      })
    } else if (elements === null || elements.length === 0) {
      // Disable deselecting all elements by clicking off the graph
      // If selection is null/empty reset selection to stored selected courses
      this.setGraphState({
        selectedCourses: [...this.state.selectedCourses],  // new array (shallow copy) so useEffect activates
        forceProviderSelectionUpdate: true  // force so 1 selection isn't skipped
      });
    } else if (elements.length === 1) {
      // User selection of single node
      // Note: deselection down to 1 loopback is covered earlier and selection up to 1 does not loopback
      // TODO: Check that multiple selection on the graph isn't possible
      const selectedCourse = elements[0].id;
      let newGraphElements = cloneDeep(this.state.graphElements);
      let selectedCourses;
      let forkedDependencies;
      let forceProviderSelectionUpdate = false;

      if (this.state.selectedCourses.includes(selectedCourse)) {
        // Deselect the selected course
        ({ selectedCourses, forkedDependencies, forceProviderSelectionUpdate } = this.handleCourseDeselection(selectedCourse));
      } else {
        // Add the selected course
        ({ selectedCourses, forkedDependencies } = this.handleNewCourseSelection(selectedCourse));
      }

      this.updateCSSForkedCourses(newGraphElements, forkedDependencies);
      this.updateAnimatedEdges(newGraphElements, selectedCourses, forkedDependencies);
      this.removeAllHighlights(newGraphElements);

      this.setGraphState({
        graphElements: newGraphElements,
        selectedCourses: selectedCourses,
        forkedDependencies: forkedDependencies,
        forceProviderSelectionUpdate: forceProviderSelectionUpdate
      });
      if (DEBUG_OUTPUT) console.log("[onSelectionChange] FINAL Elements: ", newGraphElements);
      if (DEBUG_OUTPUT) console.log("[onSelectionChange] FINAL Selected: ", selectedCourses);
      if (DEBUG_OUTPUT) console.log("[onSelectionChange] FINAL Forked: ", forkedDependencies);
    }
  }
  
  handleChildClick = (data,e) => {
    e.stopPropagation();
    var str_cond;
    let graph = [];
    var id = data.label;
    //console.log(typeof(data.label));
    //ref.on("value", function(snapshot) {
        //snapshot.forEach((child) => {
          for(var i=0;i<160;i++){
            //if(child.val()[i].course){
            //console.log(child.val()[i].course);
            var ref1 = firebase.database().ref("Subject Area/"+i+"/course");
            ref1.on("value", function(snapshot) {
              snapshot.forEach((child) => {
                
                if(child.key===id){
                  //str_cond = child.val().conditions;
                  //console.log(child.val().conditions);
                  //console.log("happy");
                  notification.open({
                    duration:6,
                    top:70,
                    message: id+' Pre-req',
                    description:
                      //str.split(8),
                      child.val().conditions,
                    
                    onClick: () => {
                      console.log('Notification Clicked!');
                    },
                    icon: <InfoOutlined style={{ color: '#108ee9' }} />,
                    style: {
                      width: 650,
                    },
                    
                  });
                }
            });
            }, function (error) {
            console.log("Error: " + error.code);
        });
        }
      //});
      //}, function (error) {
      //  console.log("Error: " + error.code);
      //});
    
  }

  ClickHandbook = (data,e) => {
    e.stopPropagation();
    var str_cond;
    let graph = [];
    var id = data.label;
    //console.log(typeof(data.label));
    //ref.on("value", function(snapshot) {
        //snapshot.forEach((child) => {
          for(var i=0;i<160;i++){
            //if(child.val()[i].course){
            //console.log(child.val()[i].course);
            var ref1 = firebase.database().ref("Subject Area/"+i+"/course");
            ref1.on("value", function(snapshot) {
              snapshot.forEach((child) => {
                
                if(child.key===id){
                  //str_cond = child.val().conditions;
                  //console.log(child.val().conditions);
                  //console.log("happy");
                  var str = child.val().handbook;
                  //http://www.handbook.unsw.edu.au/undergraduate/courses/2021/COMP1511.html
                  //https://www.handbook.unsw.edu.au/undergraduate/courses/2021/COMP1511
                  //http://www.handbook.unsw.edu.au/undergraduate/courses/2021/COMP1511
                  //https://blog.csdn.net/think_yang_1991/article/details/84819948
                  var s1 = str.substring(0,str.length-5);
                  notification.open({
                    duration:6,
                    top:70,
                    message: id+' Handbook link',
                    description:
                    //child.val().handbook,
                    <a href={s1} target="_blank">Redirect to handbook</a>,
                    onClick: () => {
                      console.log('Notification Clicked!');
                    },
                    icon: <BookOutlined style={{ color: '#108ee9' }} />,
                    style: {
                      width: 650,
                    },
                  });
                }
            });
            }, function (error) {
            console.log("Error: " + error.code);
        });
        }
      //});
      //}, function (error) {
      //  console.log("Error: " + error.code);
      //});
    
  }

  ClickTimetable = (data,e) => {
    e.stopPropagation();
    var str_cond;
    let graph = [];
    var id = data.label;
    //console.log(typeof(data.label));
    //ref.on("value", function(snapshot) {
        //snapshot.forEach((child) => {
          for(var i=0;i<160;i++){
            //if(child.val()[i].course){
            //console.log(child.val()[i].course);
            var ref1 = firebase.database().ref("Subject Area/"+i+"/course");
            ref1.on("value", function(snapshot) {
              snapshot.forEach((child) => {
                
                if(child.key===id){
                  //str_cond = child.val().conditions;
                  //console.log(child.val().conditions);
                  //console.log("happy");
                  var str = child.val().timetable;
                  //http://timetable.unsw.edu.au/2021/SENG2011.html
                  //var s1 = str.substring(0,str.length-5);
                  notification.open({
                    duration:6,
                    top:70,
                    message: id+' Timetable link',
                    description:
                      //child.val().timetable,
                      <a href={str} target="_blank">Redirect to timetable</a>,
                    onClick: () => {
                      console.log('Notification Clicked!');
                    },
                    icon: <CalendarOutlined style={{ color: '#108ee9' }} />,
                    style: {
                      width: 650,
                    },
                  });
                }
            });
            }, function (error) {
            console.log("Error: " + error.code);
        });
        }
      //});
      //}, function (error) {
      //  console.log("Error: " + error.code);
      //});
    
  }

  getSelectedCourses = (e) => {
    var str = e.target.innerText;
    var str1 = str.trim();
    selectedSubjects=this.props.selectedSubjects;
    //console.log(str1);
    //console.log(this.props.selectedSubjects);
    //console.log("Graph.js",selectedCourse);
    selected=getCourse(str1,this.props.selectedSubjects).prereq
    //console.log(selected);
    //console.log(typeof(e.target.innerText));
    //console.log(str.trim());
  }

  updateCSSForkedCourses(newGraphElements, forkedDependencies) {
    if (DEBUG_OUTPUT) console.log("[updateForkedCourses] forkedDependencies: ", forkedDependencies);

    // Reset all fork CSS classes
    newGraphElements.filter(elem => isNode(elem)).forEach(elem => elem.className = removeCSSClass(elem.className, /course-fork(-\d+)?/g));

    let forkedDepsList = Object.values(forkedDependencies).flat();
    if (DEBUG_OUTPUT) console.log("[updateForkedCourses] forkedDepsList: ", forkedDepsList);
    // TODO: What if course is a dependency of multiple courses? - CSS classes will override each other
    for (let i = 0; i < forkedDepsList.length; i++) {
      // TODO: Maybe want to filter out non-rendered nodes here, save on some i uses
      for (const courseCode of forkedDepsList[i]) {
        const elem = newGraphElements.find(x => x.id === courseCode);
        if (elem !== undefined) {
          elem.className = appendCSSClass(elem.className, "course-fork" + (i > 8 ? "" : "-"+i));  // Limit .course-fork-[0-8]
        }
      }
    }
    // if (DEBUG_OUTPUT) console.log("[GraphProvider] Updated node classes: ", newGraphElements);
  }

  updateAnimatedEdges(newGraphElements, selectedCourses, forkedDependencies) {
    const edges = newGraphElements.filter(x => isEdge(x));
    for (const edge of edges) {
      const highlightEdge = ((selectedCourses.includes(edge.source) && selectedCourses.includes(edge.target))
        || (edge.target in forkedDependencies
          && forkedDependencies[edge.target].flat().includes(edge.source)));
      edge.animated = highlightEdge;
      edge.isHidden = !highlightEdge;
    }
    // if (DEBUG_OUTPUT) console.log("[updateAnimatedEdges] updated new elements: ", newGraphElements);
  }

  handleCourseDeselection(selectedCourse) {
    return this.removeSelectedCourses([selectedCourse]);
  }

  removeSelectedCourses(removeCourses) {
    // Step 1 - remove from selectedCourses
    const newCourses = this.state.selectedCourses.filter(x => !removeCourses.includes(x));
    let newForkedDependencies = cloneDeep(this.state.forkedDependencies);
    // Step 2 - remove from forkedCourses
    for (const course of removeCourses) {
      if (course in newForkedDependencies) {
        delete newForkedDependencies[course];
      }
    }
    // Step 3 - find any new forked courses to be added (where removed are prereqs)
    const dependents = findDependentSelectedCourses(newCourses, removeCourses, this.props.selectedSubjects);
    if (DEBUG_OUTPUT) console.log("[removeSelectedCourses] Dependents: ", dependents);
    this.deepMergeIntoForkedDependencies(newForkedDependencies, dependents);
    // Step 4 - prune in case any new forks are already satisfied
    this.pruneForkedDependencies(newForkedDependencies, newCourses);
    if (DEBUG_OUTPUT) console.log("[removeSelectedCourses] newForked: ", newForkedDependencies);
    return {
      selectedCourses: newCourses,
      forkedDependencies: newForkedDependencies,
      forceProviderSelectionUpdate: true  // force updating even if only left with one element
    };
  }

  deepMergeIntoForkedDependencies(existingDeps, newDeps) {
    for (const course of Object.keys(newDeps)) {
      if (course in existingDeps) {
        this.mergeForkedDepsPrereqs(existingDeps[course], newDeps[course]);
      } else {
        existingDeps[course] = newDeps[course];
      }
    }
  }

  mergeForkedDepsPrereqs(existingPrereqs, newPrereqs) {
    for (const prereqList of newPrereqs) {
      let foundMatch = false;
      for (const pList of existingPrereqs) {
        if (arraysAreEqual(prereqList, pList)) {
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) {
        existingPrereqs.push(prereqList);
      }
    }
  }

  handleNewCourseSelection(selectedCourse) {
    const {selected, forkedDependencies} = this.getSelectedDependencies(selectedCourse);
    const allSelected = [...new Set(this.state.selectedCourses.concat(selected))];
    let allForkedDependencies = cloneDeep(this.state.forkedDependencies);
    this.simpleMergeForkedDependencies(allForkedDependencies, forkedDependencies);
    this.pruneForkedDependencies(allForkedDependencies, allSelected);
    return {
      selectedCourses: allSelected,
      forkedDependencies: allForkedDependencies
    };
  }

  getSelectedDependencies(selectedCourse) {
    let selected = []
    let unvisited = [selectedCourse];
    if (DEBUG_OUTPUT) console.log("[getSelectedDependencies] unvisited: ", unvisited);
    let currCourseCode;
    let forkedDependencies = {};
    let COUNTER = 0;
    while (unvisited.length > 0 && COUNTER < 100) {
      currCourseCode = unvisited[0];
      const course = getCourse(currCourseCode, this.props.selectedSubjects)
      // if (DEBUG_OUTPUT) console.log(course);
      if (course !== undefined) {
        selected.push(currCourseCode);
        const prereqs = course.prereq;
        for (const prereqList of prereqs) {
          const graphPrereqs = filterForGraph(prereqList, this.props.selectedSubjects);
          if (graphPrereqs.length === 1) {
            // AND course -> safe to add
            unvisited = unvisited.concat(prereqs[0]);
          } else {
            // if length > 1 -> OR course, stop processing this path
            // if length = 0 -> All dependencies are not nodes in the current graph (probably other subject areas)
            addToMappedList(forkedDependencies, currCourseCode, prereqList);
          }
        }
      }
      unvisited = arrayRemoveShallow(unvisited, currCourseCode);
      if (DEBUG_OUTPUT) console.log("[getSelectedDependencies] unvisited: ", unvisited);
      COUNTER++;
    }
    if (COUNTER === 100) {
      if (DEBUG_OUTPUT) console.log("[getSelectedDependencies] COUNTER === 100!!!");
    }
    if (DEBUG_OUTPUT) console.log("[getSelectedDependencies] course: ", selectedCourse);
    if (DEBUG_OUTPUT) console.log("[getSelectedDependencies] selectedCourses: ", selected);
    if (DEBUG_OUTPUT) console.log("[getSelectedDependencies] forkedDependencies: ", forkedDependencies);
    return {
      selected: selected,
      forkedDependencies: forkedDependencies
    }
  }

  simpleMergeForkedDependencies(existingDeps, newDeps) {
    // Simplistic merge -> only add new keys
    // If a key already exists in the dependencies, then either it will have
    // all the prereqs (that are in newDeps), or it will have been pruned by user selections
    // in which case the new dependencies will also presumably be pruned by selectedCourses
    return Object.keys(newDeps).filter(key => !(key in existingDeps)).forEach(x => existingDeps[x] = newDeps[x]);
  }

  /**
   * Remove any forked dependencies that are already satisfied
   * by existing selected courses (including the newly added course).
   */
  pruneForkedDependencies(forkedDeps, selectedCourses) {
    for (const courseCode of Object.keys(forkedDeps)) {
      const newPrereqs = forkedDeps[courseCode].filter(prereqList => arrayIntersection(prereqList, selectedCourses).length === 0);
      if (newPrereqs.length === 0) {
        delete forkedDeps[courseCode];
      } else {
        forkedDeps[courseCode] = newPrereqs;
      }
    }
  }

  clearSelectedCourses = () => {
    let newGraphElements = cloneDeep(this.state.graphElements);
    let newForkedDependencies = {};
    let newSelectedCourses = [];
    this.updateCSSForkedCourses(newGraphElements, newForkedDependencies);
    this.updateAnimatedEdges(newGraphElements, newSelectedCourses, newForkedDependencies);
    this.removeAllHighlights(newGraphElements);
    this.setGraphState({
      graphElements: newGraphElements,
      selectedCourses: newSelectedCourses,
      forkedDependencies: newForkedDependencies,
      forceProviderSelectionUpdate: true
    });
  }

  onNodeMouseEnter(event, node) {
    if (DEBUG_OUTPUT) console.log("[onNodeMouseEnter] Event: ", event, " Node: ", node);
    const newElems = cloneDeep(this.state.graphElements);
    // Clear existing highlights if they are sticky - and still in the graph
    if (this.state.stickyHighlights) {
      this.removeAllHighlights(newElems);
    }
    this.highlightLinkedCourses(newElems, node.id);
    this.setGraphState({
      graphElements: newElems
    });
  }

  highlightLinkedCourses(elements, courseCode) {
    let nodesToHighlight = [];
    // Show the linked edges
    elements.filter(x => isEdge(x)).forEach(edge => {
      if (edge.source === courseCode) {
        edge.isHidden = false;
        nodesToHighlight.push(edge.target);
      } else if (edge.target === courseCode) {
        edge.isHidden = false;
        nodesToHighlight.push(edge.source);
      } else if (!edge.animated) {
        edge.isHidden = true;
      }
    });

    if (DEBUG_OUTPUT) console.log("[highlightLinkedCourses] nodesToHighlight: ", nodesToHighlight);

    // Highlight the linked nodes
    elements.filter(x => isNode(x) && nodesToHighlight.includes(x.id)).forEach(node => {
      node.className = appendCSSClass(node.className, "node-highlight");
    });

    if (DEBUG_OUTPUT) console.log("[highlightLinkedCourses] elements: ", elements);
  }

  onNodeMouseLeave(event, node) {
    if (DEBUG_OUTPUT) console.log("[onNodeMouseLeave] Event: ", event, " Node: ", node);
    if (!this.state.stickyHighlights) {
      this.clearLinkedCourses()
    }
  }

  clearLinkedCourses() {
    const newElems = cloneDeep(this.state.graphElements);
    this.removeAllHighlights(newElems);
    this.setGraphState({
      graphElements: newElems
    });
  }

  removeAllHighlights(elements) {
    elements.filter(x => isEdge(x)).forEach(edge => {
      edge.isHidden = !edge.animated;
    });
    elements.filter(x => isNode(x)).forEach(node => {
      node.className = removeCSSClass(node.className, "node-highlight");
    })
  }

  toggleStickyHighlights = () => {
    let newSticky = !this.state.stickyHighlights;
    if (!newSticky) {
      this.clearLinkedCourses();
    }
    this.setGraphState({
      stickyHighlights: newSticky
    });
  }

  onGraphLoad(reactFlowInstance) {
    reactFlowInstance.setTransform({x: 10, y: 10, zoom: 0.8});
  }
  
  DefaultNode = ({ data, isConnectable, targetPosition = Position.Top,
    sourcePosition = Position.Bottom,}) => {
    return (
      <div>
         <Handle type="target" position={targetPosition} isConnectable={isConnectable} />
        {data.label}<p></p>
        <Handle type="source" position={sourcePosition} isConnectable={isConnectable} />
        <Tooltip title="Pre-req">
        <Button shape="circle" size="small" icon={< InfoOutlined/>} onClick={this.handleChildClick.bind(this,data)} />
      </Tooltip>&nbsp;&nbsp;
      
      <Tooltip title="Handbook">
        <Button shape="circle" size="small" icon={< BookOutlined/>} onClick={this.ClickHandbook.bind(this,data)} />
      </Tooltip>&nbsp;&nbsp;
      <Tooltip title="Timetable">
        <Button shape="circle" size="small" icon={< CalendarOutlined/>} onClick={this.ClickTimetable.bind(this,data)} />
      </Tooltip>
      </div>
    );
  };
  InputNode = ({ data, isConnectable, sourcePosition = Position.Bottom }) => {
    return (
      <div>
        {data.label}<p></p>
        <Tooltip title="Pre-req">
        <Button shape="circle" size="small" icon={< InfoOutlined/>} onClick={this.handleChildClick.bind(this,data)} />
      </Tooltip>&nbsp;&nbsp;
      
      <Tooltip title="Handbook">
        <Button shape="circle" size="small" icon={< BookOutlined/>} onClick={this.ClickHandbook.bind(this,data)} />
      </Tooltip>&nbsp;&nbsp;
      <Tooltip title="Timetable">
        <Button shape="circle" size="small" icon={< CalendarOutlined/>} onClick={this.ClickTimetable.bind(this,data)} />
      </Tooltip>
        <Handle type="source" position={sourcePosition} isConnectable={isConnectable} />
      </div>
    );
  };
  
  OutputNode = ({ data, isConnectable, targetPosition = Position.Top}) => {
    return (
      <div>
         <Handle type="target" position={targetPosition} isConnectable={isConnectable} />
        {data.label}<p></p>
        <Tooltip title="Pre-req">
        <Button shape="circle" size="small" icon={< InfoOutlined/>} onClick={this.handleChildClick.bind(this,data)} />
      </Tooltip>&nbsp;&nbsp;
      
      <Tooltip title="Handbook">
        <Button shape="circle" size="small" icon={< BookOutlined/>} onClick={this.ClickHandbook.bind(this,data)} />
      </Tooltip>&nbsp;&nbsp;
      <Tooltip title="Timetable">
        <Button shape="circle" size="small" icon={< CalendarOutlined/>} onClick={this.ClickTimetable.bind(this,data)} />
      </Tooltip>
      </div>
    );
  };
  
    SoloNode = ({ data }) => {
    return (
      <div>
        {data.label}<p></p>
        <Tooltip title="Pre-req">
          <Button shape="circle" size="small" icon={< InfoOutlined/>} onClick={this.handleChildClick.bind(this,data)} />
        </Tooltip>&nbsp;&nbsp;
        
        <Tooltip title="Handbook">
          <Button shape="circle" size="small" icon={< BookOutlined/>} onClick={this.ClickHandbook.bind(this,data)} />
        </Tooltip>&nbsp;&nbsp;
        <Tooltip title="Timetable">
          <Button shape="circle" size="small" icon={< CalendarOutlined/>} onClick={this.ClickTimetable.bind(this,data)} />
        </Tooltip>
      </div>
    );
  };

  render() {
    if (DEBUG_OUTPUT) console.log("<**Graph**>");

    return (
      <div className="Graph">
        <ReactFlowProvider>
          <div className="GraphFlow">
            <ReactFlow
              onElementClick={this.getSelectedCourses}
              elements={this.state.graphElements}
              onNodeMouseEnter={(event, node) => this.onNodeMouseEnter(event, node)}
              onNodeMouseLeave={(event, node) => this.onNodeMouseLeave(event, node)}
              onLoad={this.onGraphLoad}
              onSelectionChange={(elements) => this.onSelectionChange(elements)}
              nodeTypes={ {default:this.DefaultNode,input:this.InputNode,output:this.OutputNode,solo:this.SoloNode} }
              nodesDraggable={false}
              nodesConnectable={false} >
              <CustomControls showCourseInfo={true}
                              showClearSelection={true}
                              onClearSelection={this.clearSelectedCourses}
                              showStickyHighlights={true}
                              onStickyHighlights={this.toggleStickyHighlights}
                              isStickyHighlights={this.state.stickyHighlights} />
              <CustomBackground nodeMaxCoords={this.state.nodeMaxCoords} />
            </ReactFlow>
          </div>
          <GraphProvider
            selectedCourses={this.state.selectedCourses}
            forkedDependencies={this.state.forkedDependencies}
            forceProviderSelectionUpdate={this.state.forceProviderSelectionUpdate}
          />
        </ReactFlowProvider>
      </div>
    );
  }
  
}

//export default Graph;
export default connect(null, { assignSelection })(Graph);
