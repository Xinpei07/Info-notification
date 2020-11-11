import sampleData from './sampleData'
// import sampleData from './sampleDataAND'
import memoizeOne from "memoize-one";
import {addToMappedList, arrayIntersection, memoizeArrayCompareFn} from "./GraphUtil";
import {
  NODE_APPROX_HEIGHT, NODE_APPROX_WIDTH,
  NODE_BASE_Y_COORD_SPACING,
  NODE_X_COORD_SPACING,
  SUBJECT_Y_COORD_SPACING
} from "./graph/GraphConstants";

export function generateGraphElements(subjectAreas) {
  // console.log("Generating...", subjectAreas);

  const data = memoizedLoadData(subjectAreas);
  const sortedSubjects = [...subjectAreas].sort();
  const {graphNodes, maxCoords} = getGraphNodes(sortedSubjects, data);
  const graphEdges = getGraphEdges(data);

  // Adjust the node type based on the final edges
  const edgeSources = graphEdges.map(x => x.source);
  const edgeTargets = graphEdges.map(x => x.target);
  for (let node of graphNodes) {
    let edgeIn = edgeTargets.includes(node.id);
    let edgeOut = edgeSources.includes(node.id);
    if(edgeIn && edgeOut){
      node.type = "default";
    }
    if (!edgeIn && !edgeOut) {
      node.type = "solo";
    } else if (!edgeIn) {
      node.type = "input";
    } else if (!edgeOut) {
      node.type = "output";
    } 
  }

  const finalElems = graphNodes.concat(graphEdges);

  // console.log(graphNodes);
  return {
    elements: finalElems,
    nodeMaxCoords: maxCoords
  };
}

/**
 * Load a subset of the data for the given subject areas.
 * Note: This should not be called directly - use memoizedLoadData().
 */
function loadData(subjectAreas) {
  // TODO: this should load from the DB
  // console.log("Loading new data...", subjectAreas);
  return sampleData.filter(course => subjectAreas.includes(course.code.substring(0,4)));
}

/**
 * Reload the data only if the subject areas have changed.
 */
const memoizedLoadData = memoizeOne(loadData, memoizeArrayCompareFn);

function getGraphNodes(subjectAreas, data) {
  let graphNodes = [];

  let yCoordOffset = 0;
  let maxCoords = [];
  for (const subjectArea of subjectAreas) {
    const subjectData = data.filter(course => course.code.substring(0,4) === subjectArea);
    if (subjectData.length === 0) {
      continue;
    }
    const {nodes, maxYStart, maxXStart} = nodePositioningPerSubject(subjectData, yCoordOffset);
    maxCoords.push({
      subject: subjectArea,
      coords: {
        yStart: yCoordOffset,
        yTotal: maxYStart + NODE_APPROX_HEIGHT,
        maxX: maxXStart + NODE_APPROX_WIDTH
      }
    });
    graphNodes.push(...nodes);
    yCoordOffset += ((maxYStart + NODE_APPROX_HEIGHT) + SUBJECT_Y_COORD_SPACING);
  }

  // console.log("[getGraphNodes] maxCoords: ", maxCoords);
  return {
    graphNodes: graphNodes,
    maxCoords: maxCoords
  };
}

/**
 * Generate graph nodes for a particular subject area.
 *
 * The algorithm first partitions the courses in two stages:
 *   1. Partition the courses by level (e.g. COMP2121 is Level 2)
 *   2. Sub-partition each partition to remove vertical dependencies
 *      (i.e. a course's prerequisite cannot be in the same partition)
 *
 * The nodes are then created and arranged into columns for each partition, in order by level.
 * Vertically, nodes are distributed evenly within a column based on the max courses in all columns.
 *
 * @param data          the list of course data for that subject area
 * @param yCoordOffset  the vertical offset for that subject area
 * @returns {{nodes: [], maxYStart: number, maxXStart: number}}
 */
function nodePositioningPerSubject(data, yCoordOffset) {
  // Generate the initial partitioning by course level
  const coursesByLevel = partitionCoursesByLevel(data);

  // Generate the second partitioning for each level to avoid vertical dependencies
  let partitionedCourses = {}
  const sortedLevelKeys = Object.keys(coursesByLevel).sort((a, b) => { return a > b ? 1 : -1 });
  for (const levelKey of sortedLevelKeys) {
    const levelCourses = coursesByLevel[levelKey];
    partitionedCourses[levelKey] = partitionCoursesByDependencies(levelCourses);
  }

  // Flatten the partitioned courses while maintaining order
  let orderedPartitionedCourses = [];
  const sortedPartitionLevelKeys = Object.keys(partitionedCourses).sort((a, b) => { return a > b ? 1 : -1 });
  for (const partitionLevelKey of sortedPartitionLevelKeys) {
    const sortedPartitionKeys = Object.keys(partitionedCourses[partitionLevelKey]).sort((a, b) => { return a > b ? 1 : -1 });
    for (const partitionKey of sortedPartitionKeys) {
      orderedPartitionedCourses.push(partitionedCourses[partitionLevelKey][partitionKey]);
    }
  }

  return generateNodesFromPartition(orderedPartitionedCourses, yCoordOffset);
}

function partitionCoursesByLevel(data) {
  let coursesByLevel = {};
  for (let course of data) {
    const level = "L" + course.code.substring(4,5);
    if (level in coursesByLevel) {
      coursesByLevel[level].push(course);
    } else {
      coursesByLevel[level] = [course];
    }
  }

  return coursesByLevel;
}

function partitionCoursesByDependencies(levelCourses) {
  let partitionedCourses = {};
  let unallocatedCourses = [].concat(levelCourses);
  let partition = 0;
  do {
    const independentCourses = findIndependentCourses(unallocatedCourses);
    partitionedCourses["P" + partition] = independentCourses;
    unallocatedCourses = unallocatedCourses.filter(course => !independentCourses.includes(course));
    partition++;
  } while (unallocatedCourses.length > 0);

  return partitionedCourses;
}

function findIndependentCourses(courses) {
  return courses.filter(course => courseIntersection(allFlatPrereqs(course), courses).length === 0)
}

function courseIntersection(prereqCodeList, courseList) {
  return courseList.filter(course => prereqCodeList.includes(course.code));
}

function allFlatPrereqs(course) {
  return course.prereq.flat();
}

function generateNodesFromPartition(orderedPartitionedCourses, yCoordOffset) {
  // Calculate the max vertical spacing
  const maxPartitionSize = orderedPartitionedCourses.map(x => x.length).reduce((acc, curr) => Math.max(acc, curr), 0);
  const maxHeight = (maxPartitionSize - 1) * NODE_BASE_Y_COORD_SPACING;

  let nodes = [];
  let xCoord = 0;
  for (const partitionedCourses of orderedPartitionedCourses) {
    // const courses = partitionedCourses[partitionKey];

    // Calculate vertical spacing based on the number of nodes in the partition
    let yCoord;
    let nodeGapHeight;
    if (partitionedCourses.length === maxPartitionSize) {
      nodeGapHeight = NODE_BASE_Y_COORD_SPACING;
      yCoord = 0;
    } else {
      nodeGapHeight =  maxHeight / (partitionedCourses.length + 1);
      yCoord = nodeGapHeight;
    }

    // Generate the nodes for the Graph component
    for (const course of partitionedCourses) {
      const position = { x: xCoord, y: (yCoord + yCoordOffset) };
      nodes.push(createGraphNode(course.code, position));
      yCoord += nodeGapHeight;
    }

    xCoord += NODE_X_COORD_SPACING;
  }

  // console.log("Final nodes", nodes);

  return {
    "nodes": nodes,
    // return maxHeight for calculating subject offset
    "maxYStart": maxHeight,
    "maxXStart": ( xCoord > NODE_X_COORD_SPACING ? xCoord - NODE_X_COORD_SPACING : xCoord)
  };
}

function createGraphNode(courseCode, position, type = "default") {
  return {
    // TODO: confirm that course code is a valid unique identifier
    id: courseCode,
    position: position,
    data: {label: courseCode},
    type: type,
    targetPosition: 'left',
    sourcePosition: 'right',
  }
}


//with new implementation, we require the nodes to be inserted into the graph already in order to create the edge components
//GraphEdge requires the json obj queried from the backend
//only does course prerequisites at the moment
function getGraphEdges(data) {
  var edges = [];
  var visited = [];
  //grab the node results from the api end point, add the end point here
  for (let course of data){
    var prereqList = [];
    if(visited.includes(course.code))
      continue;
    if(course.prereq.length <= 0)
      continue;
    for(const pcourses in course.prereq){
      for (var prereqs of course.prereq[pcourses]){
        if(prereqList.includes(prereqs))
          continue;
        if(idExists(prereqs, data)){
          const newEdge = createGraphEdge(prereqs, course.code);
          edges.push(newEdge);
          prereqList.push(prereqs);
        }
      }
    }
    visited.push(course.code);
  }
  // console.log(edges)
  return edges;
}

function createGraphEdge(source, target, type = "default", animated = false, isHidden = true) {
  return {
    id: 'e' + source + '-' + target,
    source: source,
    target: target,
    type: type,
    animated: animated,
    arrowHeadType: 'arrow',
    markerEndId: 'https://icon-library.com/icon/arrow-head-icon-16.html',
    style: { stroke: 'grey' },
    isHidden: isHidden
  }
}

function idExists(courseCode, data){
  for(let course of data){
    if(course.code === courseCode){
      //return course.id;
      return true;
    }
  }
  return false;
}

// //this is to change to unique_id look up in the future
// function idLookUp(courseCode, courseList, data){
//   var id = -1;
//   for(let course in data){
//     if(course.code === courseCode){
//       //return course.id;
//       return course.code
//     }
//   }
//   return id;
// }

export function getAllFlatDependencies(courseCode, subjectAreas, dependenciesOnly = false) {
  const course = getCourse(courseCode, subjectAreas);
  if (course === undefined) {
    // Probably the dependency is a subject area not currently selected
    // console.log("Could not get course for: " + courseCode);
    return [];
  }
  let dependencyCodes = dependenciesOnly ? [] : [courseCode];
  dependencyCodes = dependencyCodes.concat(course.prereq.flat().flatMap(code => getAllFlatDependencies(code, subjectAreas)));
  // console.log("Dependencies for " + courseCode + ": ", dependencyCodes);
  return [...new Set(dependencyCodes)];
  // for (let prereqCode of course.prereqs.flat()) {
  //   const prereq = getCourse(prereqCode);
  //   dependencyCodes.push(prereq.prereqs.flat().map(code => getAllFlatDependencies(code)));
  // }
}

export function getCourse(code, subjectAreas) {
  const data = memoizedLoadData(subjectAreas);
  return data.find(x => x.code === code);
}

/**
 * Filter the given list of courses to only those that exist in the graph.
 * This will filter out courses that are not under the current subject areas.
 * @param courseCodes     list of course codes to filter
 * @param subjectAreas    list of currently selected subject areas (for loading data)
 * @returns {string[]}    a filtered list of course codes
 */
export function filterForGraph(courseCodes, subjectAreas) {
  const data = memoizedLoadData(subjectAreas);
  return courseCodes.filter(code => idExists(code, data));
}

/**
 * Find any existing selected courses that depend on the given courses.
 *
 * @param selectedCourses    the list of currently selected courses
 * @param targetCourseCodes  the list of courses to be checked for as prerequisite
 * @param subjectAreas       the list of currently selected subject areas (used for loading data)
 * @returns {{}}             a mapping of selected courses to a list of prereq dependency lists
 *                           E.g. {COMP2511: [ ["COMP1531"], ["COMP2521", "COMP1927"] ]}
 */
export function findDependentSelectedCourses(selectedCourses, targetCourseCodes, subjectAreas) {
  let dependents = {};
  for (const courseCode of selectedCourses) {
    const course = getCourse(courseCode, subjectAreas);
    if (course === undefined) {
      continue;
    }
    for (const prereqList of course.prereq) {
      if (arrayIntersection(prereqList, targetCourseCodes).length > 0) {
        addToMappedList(dependents, course.code, prereqList)
      }
    }
  }
  return dependents;
}

/**
 * Find any existing selected courses that depend on any courses in the given subject area.
 *
 * @param selectedCourses    the list of currently selected courses
 * @param targetSubjectArea  the subject area for courses to be check for as prereqs
 * @param allSubjectAreas    the list of currently selected subject areas (used for loading data)
 * @returns {{}}             a mapping of selected courses to a list of prereq dependency lists
 *                           E.g. {COMP2511: [ ["COMP1531"], ["COMP2521", "COMP1927"] ]}
 */
export function findDependentSelectedCoursesForSubjectArea(selectedCourses, targetSubjectArea, allSubjectAreas) {
  let dependents = {};
  for (const courseCode of selectedCourses) {
    const course = getCourse(courseCode, allSubjectAreas);
    if (course === undefined) {
      continue;
    }
    for (const prereqList of course.prereq) {
      if (prereqList.map(x => x.substring(0,4).includes(targetSubjectArea))) {
        addToMappedList(dependents, course.code, prereqList)
      }
    }
  }
  return dependents;
}
