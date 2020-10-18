import data from './sampleData'

const SUBJECT_Y_COORD_SPACING = 200;
const NODE_X_COORD_SPACING = 300;
const NODE_BASE_Y_COORD_SPACING = 150;

export function getGraphNodes() {
  let graphNodes = [];

  // TODO: get this from the filter
  const subjectAreas = new Set(data.map(course => course.code.substring(0,4)));

  let yCoordOffset = 0;
  for (const subjectArea of subjectAreas) {
    const subjectData = data.filter(course => course.code.substring(0,4) === subjectArea);
    const {nodes, maxHeight} = nodePositioningPerSubjectV2(subjectData, yCoordOffset);
    graphNodes.push(...nodes);
    yCoordOffset += (maxHeight + SUBJECT_Y_COORD_SPACING);
  }

  return graphNodes;
}

function createGraphNode(courseCode, position, type = "default") {
  return {
    // TODO: confirm that course code is a valid unique identifier
    id: courseCode,
    position: position,
    data: { label: courseCode },
    type: type,
    targetPosition: 'left',
    sourcePosition: 'right',
  }
}


/**
 * Generate graph nodes for a particular subject area.
 * The layout algorithm works by partitioning the courses into columns based on 2 criteria
 *   1. The level of the course (e.g. COMP2121 is Level 2)
 *   2. Whether that course has any dependencies
 * Vertically, nodes distributed evenly within a column based on the max courses in all columns
 *
 * @param data  the list of course data for that subject area
 * @param yCoordOffset  the vertical offset for that subject area
 */
function nodePositioningPerSubject(data, yCoordOffset) {
  const NODE_X_COORD_SPACING = 400
  const NODE_BASE_Y_COORD_SPACING = 100

  // Partition the courses into columns based on level and whether they have dependencies
  let partitionedCourses = {};
  for (let course of data) {
    const partitionKey = "L" + course.code.substring(4,5) + (course.prereq.length > 0 ? "D" : "");
    if (partitionKey in partitionedCourses) {
      partitionedCourses[partitionKey].push(course);
    } else {
      partitionedCourses[partitionKey] = [course];
    }
  }
  console.log("Initial partition", partitionedCourses);

  // Calculate the max vertical spacing
  const maxPartitionSize = Object.values(partitionedCourses).map(x => x.length).reduce((acc, curr) => Math.max(acc, curr), 0);
  const maxHeight = (maxPartitionSize - 1) * NODE_BASE_Y_COORD_SPACING;

  let nodes = [];
  const sortedPartitionKeys = Object.keys(partitionedCourses).sort((a, b) => { return a > b ? 1 : -1 });
  console.log("Partition keys", sortedPartitionKeys);
  let xCoord = 0;

  for (const partitionKey of sortedPartitionKeys) {
    const courses = partitionedCourses[partitionKey];

    // Calculate vertical spacing based on the number of nodes in the partition
    let yCoord;
    let nodeGapHeight;
    if (courses.length === maxPartitionSize) {
      nodeGapHeight = NODE_BASE_Y_COORD_SPACING;
      yCoord = 0;
    } else {
      nodeGapHeight =  maxHeight / (courses.length + 1);
      yCoord = nodeGapHeight;
    }
    console.log("Node height for: " + partitionKey + " = " + nodeGapHeight);

    for (const course of courses) {
      const position = { x: xCoord, y: (yCoord + yCoordOffset) };
      const type = getNodeType(course);
      nodes.push(createGraphNode(course.code, position, type));
      yCoord += nodeGapHeight;
    }

    xCoord += NODE_X_COORD_SPACING;
  }

  console.log("Final nodes", nodes);

  return nodes;
}

function getNodeType(course) {
  // TODO: work out "output" nodes (that are not dependent on any courses)
  if (course.prereq.length === 0) {
    return "input";
  }
  return "default";
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
 * @returns {{nodes: [], maxHeight: number}}
 */
function nodePositioningPerSubjectV2(data, yCoordOffset) {
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
  return courses.filter(course => courseIntersection(allPrereqs(course), courses).length === 0)
}

function courseIntersection(prereqCodeList, courseList) {
  return courseList.filter(course => prereqCodeList.includes(course.code));
}

function allPrereqs(course) {
  // TODO: this ignores AND vs OR
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
      const type = getNodeType(course);
      nodes.push(createGraphNode(course.code, position, type));
      yCoord += nodeGapHeight;
    }

    xCoord += NODE_X_COORD_SPACING;
  }

  console.log("Final nodes", nodes);

  return {
    "nodes": nodes,
    // return maxHeight for calculating subject offset
    "maxHeight": maxHeight
  };
}


//with new implementation, we require the nodes to be inserted into the graph already in order to create the edge components
//GraphEdge requires the json obj queried from the backend
//only does course prerequisites at the moment
export function getGraphEdges() {
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
        if(idExists(prereqs)){
          const newEdge = createGraphEdge(prereqs, course.code);
          edges.push(newEdge);
          prereqList.push(prereqs);
        }
      }
    }
    visited.push(course.code);
  }
  console.log(edges)
  return edges;
}

function createGraphEdge(source, target, type = "default", animated = true) {
  return {
    id: 'e' + source + '-' + target,
    source: source,
    target: target,
    type: type,
    animated: animated,
    arrowHeadType: 'arrow',
    markerEndId: 'https://icon-library.com/icon/arrow-head-icon-16.html',
    style: { stroke: 'grey' },
  }
}

function idExists(courseCode){
  for(let course of data){
    if(course.code === courseCode){
      //return course.id;
      return true;
    }
  }
  return false;
}

//this is to change to unique_id look up in the future
function idLookUp(courseCode, courseList){
  var id = -1;
  for(let course in data){
    if(course.code === courseCode){
      //return course.id;
      return course.code
    }
  }
  return id;
}
