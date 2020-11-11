import {ASSIGN_FILTER, ASSIGN_SELECTION} from "./actionTypes"

export const assignFilter = content =>({
    type: ASSIGN_FILTER,
    payload: {
        filter: content
    }
});


export const assignSelection = content => ({
    type: ASSIGN_SELECTION,
    payload:{
        selection: content
    }
})