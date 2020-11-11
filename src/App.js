import React from 'react';
import {connect} from 'react-redux';
import {getFilterList} from './redux/selectors'
import {assignFilter} from './redux/actions'
import './App.css';
import Graph from "./components/Graph";
import SearchCourse from './components/SearchCourse'
import TermTable from './components/TermTable';
import PlanTable from './components/PlanTable';
import { Layout, Menu, Breadcrumb } from 'antd';
import { UserOutlined, LaptopOutlined, NotificationOutlined, CalculatorFilled} from '@ant-design/icons';
import { PageHeader } from 'antd';

const { SubMenu } = Menu;
const { Header, Footer, Sider, Content } = Layout;

class App extends React.Component{
  constructor(props) {
    super(props); 
    this.props.assignFilter([]);
  }
  
  render() {
    const filterList = Array.isArray(this.props.filter.filter) ? this.props.filter.filter : [];
    // console.log(filterList)

    return (
      <div className="App">
      <Layout>
        <Header className="header">
          <div className="logo"/>
            <Menu theme="dark" mode="horizontal" >
              <h className="title">Visual Degree Planner</h>
              {/*<Menu.Item key="1" style={{float: 'right'}}>nav 1</Menu.Item>
              <Menu.Item key="2" style={{float: 'right'}}>nav 2</Menu.Item>
    <Menu.Item key="3" style={{float: 'right'}}>nav 3</Menu.Item>*/}
    </Menu>
       </Header>
      <Layout>
      <Sider theme="light" width={200} className="site-layout-background">
        <SearchCourse/>
       
      </Sider>
      <Layout >
        <Content className="site-layout-background-graph"
         style={{ margin: '0 0 0' }}>
          <Graph selectedSubjects={filterList}/>
        </Content>
      </Layout>
      </Layout>
    </Layout>
    <div className="row">
    <Menu theme="dark" mode="horizontal" >
        <PlanTable></PlanTable>
        
        </Menu>
        <TermTable></TermTable>
    </div>
    </div>
    );
  }
}

const mapStateToProps = state =>{
  const filter = getFilterList(state);
  return {filter};
}

export default connect(mapStateToProps, {assignFilter})(App);
