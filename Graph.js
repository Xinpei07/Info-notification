import React from 'react';
import ReactFlow, { Controls } from 'react-flow-renderer';
import './Graph.css'
import {getGraphNodes, getGraphEdges} from './GraphData';
import data from './sampleData'
import { render } from 'react-dom';
import ReactTooltip from 'react-tooltip';
import 'antd/dist/antd.css';
import { Button, notification } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

const elements = getGraphNodes().concat(getGraphEdges());
class Graph extends React.Component {
  openNotification = (MouseEvent,Node) => {
    let graph = [];
    var id=Node.id
    const prereq = data.filter(course => course.code.substring(0,8) === id);
    graph.push(...prereq);
    var str = (graph[0].prereq).toString()
    console.log(typeof(str))
    notification.open({
      message: 'Pre-req',
      description:
        str.split(8),
      onClick: () => {
        console.log('Notification Clicked!');
      },
      icon: <BulbOutlined style={{ color: '#108ee9' }} />,
      style: {
        width: 600,
      },
    });
  };

/*onElementClick(MouseEvent,Node) {
  //this.changeTip()
  let graph = [];
  var id=Node.id
  const prereq = data.filter(course => course.code.substring(0,8) === id);
  graph.push(...prereq);
}*/
   render() {
    return (
      <div className="Graph">
        <ReactFlow
            //onElementClick={this.onElementClick}          
            onElementClick={this.openNotification}          
            elements={elements}
            nodesDraggable={false}
            nodesConnectable={false} ></ReactFlow><ReactTooltip />
          {/* <Controls /> */}
          
        

      </div>
    );
  }
}

export default Graph;
