import React, { Component } from 'react';
import SubjectList from './SubjectList'
import './SearchCourse.css'; 
import HeaderSearch from 'ant-design-pro/lib/HeaderSearch';
import 'ant-design-pro/dist/ant-design-pro.css'; 

class SearchCourse extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searchTerm:"",
            showing: false,
            subj_list: []
        }
	}
    
    readJson(){             
        let subjects = require('./subjectAreas.json')
        let subjIndex=0
        for(subjIndex = 0; subjIndex<subjects.length; subjIndex++){
            let subject = subjects[subjIndex].code
            if(!this.state.subj_list.includes(subject)){
                this.state.subj_list.push(subject)
            }
        }
    }

    editSearch = (e) => {
      
        this.setState({searchTerm: e.target.value})
        
    }

    dynamicSearch = () => {
        let result = this.state.subj_list.filter(subj_list => subj_list.toLowerCase().includes(this.state.searchTerm.toLowerCase()))
        return <div>
                <SubjectList result = {result}></SubjectList>
        </div>
    }

	render() {
        this.readJson()
		return (
            
            <div>
                
                <input type = 'text' value = {this.state.searchTerm} onChange = {this.editSearch} placeholder = "Search CourseCode"></input>
                <div>{this.dynamicSearch()}</div>
            </div>
            
            
		);
	}

}

export default SearchCourse;