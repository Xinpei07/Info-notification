import{
    ASSIGN_SELECTION
} from '../actionTypes'

const initialState = {
    selection: []
  };


export default function(state = initialState, action){
    switch(action.type){
        case ASSIGN_SELECTION: {
            const content = action.payload;
            return {
                ...state, 
                selection: content
            }
        }
        default: 
            return state;
    }
}
