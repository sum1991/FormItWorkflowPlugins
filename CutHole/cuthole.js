CutHoles = {};

CutHoles.GlueToSurface = function()
{
    var value = {GlueToSurface: true};
    var currentHistory = FormIt.Model.GetHistoryID();
    WSM.Utils.SetOrCreateStringAttributeForObject(currentHistory,
        WSM.INVALID_ID, "FormIt::PlacementOptions", JSON.stringify(value));
}
FormIt.Commands.RegisterJSCommand("CutHoles.GlueToSurface");

// MakeInstanceCuttingObject marks the given instance to be the cutting object and sets the layer to CutHoles.CutHole and
// applies the CutHoles.CutHole attribute.
// An instance (1) should be selected.
CutHoles.MakeInstanceCuttingObject = function(instance)
{
    if (WSM.Utils.IsObjectType(instance, [WSM.nInstanceType]))
    {
        var finalObjectHistoryID = WSM.GroupInstancePath.GetFinalObjectHistoryID(instance);
        var nRefHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(finalObjectHistoryID.History, finalObjectHistoryID.Object);
        var editingHistoryID = FormIt.GroupEdit.GetEditingHistoryID();
        // Apply the CutHoles.CutHole attribute to the instance's ref History
        WSM.Utils.SetOrCreateStringAttributeForObject(nRefHistoryID, WSM.INVALID_ID, "CutHoles.CutHole", "");

        var allObjs = WSM.APIGetAllNonOwnedReadOnly(editingHistoryID);
        var layerID = WSM.INVALID_ID;
        // Get the existing layer ID.
        for (var j = 0; j < allObjs.length; ++j)
        {
            if (WSM.Utils.IsObjectType(WSM.ObjectHistoryID(editingHistoryID, allObjs[j]), [WSM.nLayerType]))
            {
                var layerData = WSM.APIGetLayerDataReadOnly(editingHistoryID, allObjs[j]);
                if (layerData.name == "CutHoles.CutHole")
                {
                    layerID = allObjs[j];
                }
            }
        }
        if (layerID === WSM.INVALID_ID)
        {
            layerID = WSM.APICreateLayer(editingHistoryID, "CutHoles.CutHole", true /*bDisplayed*/);
        }

        // Set the Layer for the instance
        WSM.APIAddObjectsLayers(editingHistoryID, [layerID], instance);
    }
}

// MakeCuttingObject marks selection to be the cutting object(s) and sets the layer to CutHoles.CutHole and
// applies the CutHoles.CutHole attribute.
// An instance (1) should be selected.
CutHoles.MakeCuttingObject = function()
{
    var selections = FormIt.Selection.GetSelections();
    if (selections.length > 0)
    {
        // If one selection, allow a Group (instance) or a Body.
        if (selections.length == 1)
        {
            var selection = selections[0];
            if (WSM.Utils.IsObjectType(selection, [WSM.nInstanceType]))
            {
                CutHoles.MakeInstanceCuttingObject(selection);
                return;
            }
            else if (WSM.Utils.IsObjectType(selection, [WSM.nBodyType]))
            {
                var editingHistoryID = FormIt.GroupEdit.GetEditingHistoryID();
                var nCreatedGroupID = WSM.APICreateGroup(editingHistoryID, selection);
                var nRefHistory = WSM.APIGetGroupReferencedHistoryReadOnly(editingHistoryID, nCreatedGroupID);
                var instanceAggregate = WSM.APIGetAllAggregateTransf3dsReadOnly(nRefHistory, editingHistoryID);
                if (instanceAggregate.paths.length == 1)
                {
                    CutHoles.MakeInstanceCuttingObject(instanceAggregate.paths[0]);
                }
                else
                {
                    FormIt.UI.ShowNotification("Failed to Group Body.", FormIt.NotificationType.Error, 0);
                }
            }
            else
            {
                FormIt.UI.ShowNotification("Please select one group or one or more Bodys.", FormIt.NotificationType.Error, 0);
            }   
        }
        else
        {
            // Verify only Bodys were selected.
            var bodys = [];
            for (var i = 0; i < selections.length; ++i)
            {
                if (!WSM.Utils.IsObjectType(selections[i], [WSM.nBodyType]))
                {
                    FormIt.UI.ShowNotification("Select only Body geometry that will be used to cut holes.", FormIt.NotificationType.Error, 0);
                    return;
                }
            }
            // Group the Bodys and then mark as cutting object.
            var editingHistoryID = FormIt.GroupEdit.GetEditingHistoryID();
            var nCreatedGroupID = WSM.APICreateGroup(editingHistoryID, selections);
            var nRefHistory = WSM.APIGetGroupReferencedHistoryReadOnly(editingHistoryID, nCreatedGroupID);
            var instanceAggregate = WSM.APIGetAllAggregateTransf3dsReadOnly(nRefHistory, editingHistoryID);
            if (instanceAggregate.paths.length == 1)
            {
                CutHoles.MakeInstanceCuttingObject(instanceAggregate.paths[0]);
            }
        }
    }
    else
    {
        FormIt.UI.ShowNotification("Select the geometry that will be used to cut holes.", FormIt.NotificationType.Error, 0);
    }
}
FormIt.Commands.RegisterJSCommand("CutHoles.MakeCuttingObject");

CutHoles.CutHoles = function()
{
    //console.log("------------------------------------- CutHoles.CutHoles -------------------------------------");
    var currentHistory = FormIt.GroupEdit.GetEditingHistoryID();    
    //console.log("currentHistory: " + JSON.stringify(currentHistory));
    var allHistorys = WSM.APIGetAllReachableHistoriesReadOnly(currentHistory, false);
    //console.log("allHistorys: " + JSON.stringify(allHistorys));
    var cuttingHistorys = [];
    for (var i = 0; i < allHistorys.length; ++i)
    {
        var cuttingHistory = allHistorys[i];
        //console.log("testing for cutting History: " + cuttingHistory);
        var attrib = WSM.Utils.GetStringAttributeForObject(cuttingHistory, WSM.INVALID_ID, "CutHoles.CutHole");
        //console.log(JSON.stringify(attrib));
        if(attrib.success)
        {
            cuttingHistorys.push(cuttingHistory);
        }
    }
    //console.log("cuttingHistorys: " + JSON.stringify(cuttingHistorys));
    var instances = [];
    for (var j = 0; j < cuttingHistorys.length; ++j)
    {
        var cuttingHistory = cuttingHistorys[j];
        //console.log("Getting Instances for History: " + cuttingHistory);
        var instanceAggregate = WSM.APIGetAllAggregateTransf3dsReadOnly(cuttingHistory, currentHistory);
        instances.push.apply(instances, instanceAggregate.paths);
    }
    //console.log("instances: " + JSON.stringify(instances));
    // Get the list of tools.
    var tools = [];
    for (var i = 0; i < instances.length; ++i)
    {
        var instance = instances[i];
        //console.log("instance: " + JSON.stringify(instance));
        var finalObjectHistoryID = WSM.GroupInstancePath.GetFinalObjectHistoryID(instance);
        //console.log("finalObjectHistoryID: " + JSON.stringify(finalObjectHistoryID));
        var nRefHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(finalObjectHistoryID.History, finalObjectHistoryID.Object);
        //console.log("Tools History: " + nRefHistoryID);
        var allObjs = WSM.APIGetAllNonOwnedReadOnly(nRefHistoryID);
        //console.log("All Tools allObjs: " + allObjs);
        for (var j = 0; j < allObjs.length; ++j)
        {
            var path = WSM.GroupInstancePath.AppendObjectHistoryID(instance, WSM.ObjectHistoryID(nRefHistoryID, allObjs[j]));
            if (WSM.Utils.IsObjectType(path, [WSM.nBodyType]))
            {
                tools.push(path);
            }
        }
    }
    //console.log("tools: " + JSON.stringify(tools));
    var allBlankObjs = WSM.APIGetAllNonOwnedReadOnly(currentHistory);
    //console.log("allBlankObjs: " + JSON.stringify(allBlankObjs));
    for (var i = 0; i < allBlankObjs.length; ++i)
    {
        var blank = WSM.ObjectHistoryID(currentHistory, allBlankObjs[i]);
        //console.log("blank: " + JSON.stringify(blank));
        WSM.APISubtractNonDestructive(blank, tools);
    }
}
FormIt.Commands.RegisterJSCommand("CutHoles.CutHoles");

CutHoles.ShowDialog = function()
{
    var dialogParams = {
    "PluginName": "Cut Hole",
    "DialogBox": "PLUGINLOCATION/index.html",
    "DialogBoxWidth": 640,
    "DialogBoxHeight": 480,
    "DialogBoxType": "Modeless"};

    FormIt.CreateDialogBox(JSON.stringify(dialogParams));
}
FormIt.Commands.RegisterJSCommand("CutHoles.ShowDialog");

CutHoles.DefineComponentGeometry = function()
{
    FormIt.Commands.DoCommand("Edit: Select All");
}