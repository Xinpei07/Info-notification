import React, { Component } from 'react';
import "./PlanTable.css"
import TermTable from './TermTable.js';
import {connect} from 'react-redux';
import { getFilterList, getSelection } from '../redux/selectors'
import { getPositionOfLineAndCharacter } from 'typescript';
import {assignSelection} from "../redux/actions"
import {Button} from 'antd'
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import { InfoOutlined, DeleteOutlined } from '@ant-design/icons';
import {notification, Tooltip } from 'antd';

class PlanItem extends React.Component {
    constructor(props) {
        super(props);
    }
    //reshow plan template in termtable by re-assign selection to redux, but still need to work for graph
    reShowPlan=(planId,planList,assignSelection)=>{
        assignSelection(planList[planId-1].selection);
    }
    
     //get total Uoc for each plan
     totalUoc=(planId,planList)=>{
        let codeList = []
        let course = require("./sampleData.json")
        for(let i = 0; i<course.length;i++){
            codeList.push(course[i]["code"])
        }
        let totalUoc=0;
        for(let i=0;i<planList[planId-1].selection.length;i++){
            let index = codeList.indexOf(planList[planId-1].selection[i]);
            let uoc = course[index].uoc
            totalUoc=totalUoc+uoc
        }
        let uocResult = String(totalUoc)
        console.log(totalUoc)
        return uocResult
    }

    render() {
        let { planId,planList,assignSelection,deletePlanList} = this.props;
        return (
            <div className="item">
                <div onClick={(event)=>this.reShowPlan(planId,planList,assignSelection)}>Plan {planId}</div>
                {/*<div className="uoc">{this.totalUoc(planId,planList)} UOC</div>*/}
                <Tooltip title={"UOC: "+this.totalUoc(planId,planList)+"uoc"}>
                    <Button shape="circle" size="small" icon={< InfoOutlined/>}/>
                </Tooltip>
            
               
                <IconButton aria-label="delete" onClick={(event)=>deletePlanList(planId)} color="red">
                    <DeleteIcon fontSize="small" color="#008CBA"/>
                </IconButton>
            </div>
        );
    }
}

class PlanTable extends Component {
    constructor(props) {
        super(props);
        this.state = {
            planList:[],
            planId:[]
        }
    }
    //store template in planList
    getPlanList =()=>{
        console.log(this.props.selection.selection)
        let id = this.state.planId
        let tmpList = this.state.planList
        
        if(this.props.selection.selection!=null){
            if(this.props.selection.selection.length!=0){
                if(tmpList.length==0){
                    id = [1]
                    tmpList.push(this.props.selection)
                    this.setState({planList:tmpList})
                    this.setState({planId:id})
                }else if(!tmpList.includes(this.props.selection)){
                    if(tmpList[tmpList.length-1].selection!=this.props.selection.selection){
                        id.push(this.state.planList.length+1)
                        tmpList.push(this.props.selection)
                        this.setState({planList:tmpList})
                        this.setState({planId:id})
                    }
                }
            }
        }
        // console.log(this.state.planList)
    }
    //delete the template in planList
    deletePlanList =(planId) =>{
        let tmpList = this.state.planList;
        let id = this.state.planId;
        if(tmpList.length!=1){
            //delete the template
            tmpList.splice(planId-1,1);
            id.splice(planId-1,1);
            //change item id for dispaly
            while(planId-1<tmpList.length){
                id[planId-1]=planId;
                planId++;
            }
        }else{
            tmpList = [];
            id =[]
        }
        // console.log(id)
        // console.log(tmpList)
        this.setState({planList:tmpList})
        this.setState({planId:id})
    }

	render() {
        let tasks = this.state.course_code
        const {planId, planList} = this.state
        // console.log(planId)
        // console.log(planList)
        if(planId.length==0){
            return (
                <div className="plan-wrapper">
                    <div className="plan-header">
                        <p>PLAN MODE</p>
                    </div>
                    <div className="plan-col">
                        <div className="item">Default plan</div>
                        <div class="save">
                        <button class="savebutton" onClick={(event)=>this.getPlanList()}>Save</button>
                        </div>
                    </div>
                </div>
            );
        }else{
            return (
                <div className="plan-wrapper">
                    <div className="plan-header">
                        <p>PLAN MODE</p>
                    </div>
                    <div className="plan-col">
                    {planId.map(id =>
                        <PlanItem planId ={id} planList={planList} assignSelection={this.props.assignSelection} deletePlanList={this.deletePlanList}></PlanItem>
                        // <div className="item">Plan {id}</div>
                        )}
                    <div class="save">
                        <button class="savebutton" onClick={(event)=>this.getPlanList()}>Save</button>
                        </div>
                    </div>
                </div>
            );
        }
	}

}

const mapStateToProps = state =>{
    // console.log("The selected course in state is"+ JSON.stringify(state.selection.selection))
    return state.selection;
  }

export default connect(mapStateToProps,{assignSelection})(PlanTable);