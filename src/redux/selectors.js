
export const getFilterState = store => store.filter;

export const getFilterList = store =>
    getFilterState(store) ? getFilterState(store).filters : [];

export const getSelectionState = store => store.selection;

export const getSelection = store =>
    getSelectionState(store) ? getSelectionState(store).selection : [];
