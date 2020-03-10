from qgis.core import *
import json
import processing
import re

# A Zone file (i.e. grids) that we want to scan through when, could be practically any standard
# polygon/multipolygon, the only requirement is that each zone/grid must have a unique id attribute
# field, example for this project is stored alongside this script
zoneFile = './grids.geojson'
# Output file location
output = './gridsout.geojson'


def fullMergeDict(D1, D2):
    for key, value in D1.items():
        if key in D2:
            if type(value) is dict:
                fullMergeDict(D1[key], D2[key])
            else:
                if type(value) in (int, float, str):
                    D1[key] = [value]
                if type(D2[key]) is list:
                    D1[key].extend(D2[key])
                else:
                    D1[key].append(D2[key])
    for key, value in D2.items():
        if key not in D1:
            D1[key] = value


def formatStr(input):
    input = re.sub(r'([\(\)\{\}\[\]])', '', input)
    input = re.sub(r'([^\w])', '_', input.lower())
    input = re.sub(r'[_]+', '_', input)
    return input


def getVectorFeaturesInLocation(input, zones, attributeField, strFormattingFunction):
    output = {}

    # Premeptively attempt to fix broken geometries if we are dealing with a Polygon/Multipolygon
    # Source data in this case has a set of pervasive issues with bad geometries so its easy to
    # try and fix than to detect and then decide on how to fix, this fixes 90% of geometry issues
    if (input.geometryType() in [QgsWkbTypes.Polygon, QgsWkbTypes.MultiPolygon]):
        # Buffer that polygon by 0 distance to fix common geometry areas
        fixedInput = processing.run('qgis:buffer', {
            'DISSOLVE': False,
            'DISTANCE': 0,
            'END_CAP_STYLE': 0,
            'INPUT': input,
            'JOIN_STYLE': 0,
            'MITER_LIMIT': 2,
            'OUTPUT': 'TEMPORARY_OUTPUT',
            'SEGMENTS': 5}
        )

        input = fixedInput['OUTPUT']

    # Iterate through the zones/grids in the zone file
    for zone in zones.getFeatures():
        output[zone['id']] = {}

        # Select the current feature and run an intersects query using the
        # QGIS Select By Location processing package
        zones.removeSelection()
        zones.select(zone.id())
        o = processing.run("qgis:selectbylocation", {
            'INPUT': input,
            'INTERSECT': QgsProcessingFeatureSourceDefinition(zones.id(), True),
            'METHOD': 0,
            'PREDICATE': [0, 4, 5]}
        )

        zoneOutput = []

        # Iterate through the intersecting features and write the selected attribute into
        # an array
        for feature in o['OUTPUT'].selectedFeatures():
            if (attributeField != None):
                zoneOutput.append(feature[attributeField])
            else:
                zoneOutput.append(input.name())

        # Sort, remove duplicates and then format the output string to match the required fromat later on
        # using the provided string formatting function
        sorted_list = sorted(list(set(zoneOutput)))
        output_list = []
        for output_string in sorted_list:
            output_list.append(strFormattingFunction(output_string))
        zoneOutput = sorted(list(set(output_list)))

        output[zone['id']] = zoneOutput

    return output


def getRasterStatsByLocation(input, zones, min=None, max=None):
    # If we aren't supplied with a min / max to the range then extract it from the source
    # raster
    if (not (min != None and max != None)):
        stats = input.dataProvider().bandStatistics(
            1, QgsRasterBandStats.All, input.extent(), 0)
        min = stats.minimumValue
        max = stats.maximumValue
    nodata = input.dataProvider().sourceNoDataValue(1)

    # Calculate nodata areas, 1 = data 0 = nodata
    o = processing.run("gdal:rastercalculator", {
        "INPUT_A": input,
        "BAND_A": 1,
        "FORMULA": "A != {nodata}".format(nodata=nodata),
        "OUTPUT": "TEMPORARY_OUTPUT"}
    )

    # Polygonize the output to get a coverage of all areas of data in the original raster
    o = processing.run('gdal:polygonize', {
        'BAND': 1,
        'EIGHT_CONNECTEDNESS': False,
        'FIELD': 'DN',
        'INPUT': o['OUTPUT'],
        'OUTPUT': 'TEMPORARY_OUTPUT'}
    )

    # Buffer that polygon by 0 distance to fix common geometry areas
    o = processing.run('qgis:buffer', {
        'DISSOLVE': False,
        'DISTANCE': 0,
        'END_CAP_STYLE': 0,
        'INPUT': o['OUTPUT'],
        'JOIN_STYLE': 0,
        'MITER_LIMIT': 2,
        'OUTPUT': 'TEMPORARY_OUTPUT',
        'SEGMENTS': 5}
    )

    # Select the zones that overlap with the generated polygon
    o = processing.run("qgis:selectbylocation", {
        'INPUT': zones,
        'INTERSECT': o['OUTPUT'],
        'METHOD': 0,
        'PREDICATE': [0, 4, 5]}
    )

    # Materialize the selected matching zones as a temporary file to provide the matching zones
    # to generate zonal stats for
    zones_output = zones.materialize(
        QgsFeatureRequest().setFilterFids(zones.selectedFeatureIds()))
    proj.addMapLayer(zones_output)

    # Run the QGIS zonal statistics processing tool to find the min/max for areas overalpping
    # each grid that covers the raster data
    o = processing.run("qgis:zonalstatistics", {
        'COLUMN_PREFIX': '_',
        'INPUT_RASTER': input,
        'INPUT_VECTOR': zones_output,
        'RASTER_BAND': 1,
        'STATISTICS': [5, 6]}
    )
    output = {}

    # Do a little bit of housekeeping the results (reduce to 2 decimal places) and
    # normalize the data to be in the min/max range (between 0 and 1)
    for zone in zones_output.getFeatures():

        output[zone['id']] = {
            'min': float('%.2f' % (normalize(min, max, 0, 1, zone.attribute('_min')))),
            'max': float('%.2f' % (normalize(min, max, 0, 1, zone.attribute('_max'))))
        }

    proj.removeMapLayer(zones_output)

    return output


def normalize(min, max, outmin, outmax, value):
    if value > max:
        return 1.0
    if value < min:
        return 0.0
    return ((outmax - outmin) * ((value - min) / (max - min))) + outmin

# Describes groups of layers to work over, each group follows the same pattern;
# {
#     'name': 'The name of the Layer Group to work over or `None` if the layers are in the root object',
#     'output_name': 'An output name to group the outputs for that group under',
#     'vector': {
#         'Layer name in QGIS': 'attribute field we are extracting or `None` if you just want to output the layer name (i.e. presence search rather than attribute search)',
#         ...
#     },
#     'ramp': {
#         'Layer name in QGIS': {
#             'name': 'Layer name you want in the output',
#             'min': 'Optional number denoting the minimum of the range of data for legends',
#             'max': 'Optional number denoting the maximum of the range of data for legends'
#         },
#         ...
#     }
# }
#
# NOTE: Ramps only work on uniform color ramps at present


maps = [
    {
        'name': '1. Ability of the land to moderate surface water runoff',
        'output_name': 'moderate_surface_water_runoff',
        'vector': {},
        'ramp': {
            'Ability of the land to moderate surface water runoff': {
                'name': 'moderate_surface_water_runoff',
                'min': 41.0,
                'max': 266

            }
        }
    },
    {
        'name': '2. Opportunities to enhance surface water regulation',
        'output_name': 'enhance_surface_water_regulation',
        'vector': {
            'Opportunities to enhance surface water regulation': 'Catchmnt'
        },
        'ramp': {}
    },
    {
        'name': '3. Opportunities to enhance surface water regulation: places receieving high volumes of surface water flow',
        'output_name': 'enhance_surface_water_regulation_high_volumes',
        'vector': {
            'Opportunities to enhance surface water regulation: places receieving high volumes of surface water flow': 'Catchmnt',
        },
        'ramp': {}
    },
    {
        'name': '4. Risk of erosion caused by precipitation',
        'output_name': 'erosion_risk',
        'vector': {
            'Erosion channels': None,
            'Urban and roads': None,
            'Area_excluded_from_erosion_risk_analysis': None
        },
        'ramp': {
            '4. Risk of erosion caused by precipitation': {
                'name': 'risk_of_erosion_caused_by_precipitation',
                'min': 0.0,
                'max': 0.899
            }
        }
    },
    {
        'name': '5. Places with habitat of key importance for biodiversity',
        'output_name': 'network_sources',
        'vector': {
            'Grassland and cactus habitats': 'Core',
            'Wetland habitats (including ephemeral watercourses)': 'Core',
            'Woodland habitats': 'Core'
        },
        'ramp': {}
    },
    {
        'name': '6. Places delivering multiple ecosystem service benefits; key areas for biodiversity and surface water regulation',
        'output_name': 'multi_es_benefits_water_regulation',
        'vector': {
            'Areas important for both biodiversity and surface water regulation': None,
            'Urban and roads': None
        },
        'ramp': {}
    },
    {
        'name': '7. Ecological Network Connectivity - Woodland Ecosystem',
        'output_name': 'woodland_ecosystem',
        'vector': {
            'Source woodland': None
        },
        'ramp': {
            'Woodland Ecological network': {
                'name': 'woodland_ecological_network',
                'min': 0.0,
                'max': 140000.0
            }
        }
    },
    {
        'name': '8. Ecological Network Connectivity - Wetland Ecosystem',
        'output_name': 'wetland_ecosystem',
        'vector': {
            'Source wetland': None
        },
        'ramp': {
            'Wetland ecological network': {
                'name': 'wetland_ecological_network',
                'min': 0.0,
                'max': 30000.0
            }
        }
    },
    {
        'name': '9. Ecological network connectivity - Grassland Ecosystem',
        'output_name': 'grassland_ecosystem',
        'vector': {
            'Source grassland/cactus habitat': None
        },
        'ramp': {
            'Grassland/cactus ecological network': {
                'name': 'grassland_cactus_ecological_network',
                'min': 0.0,
                'max': 90000.0
            }
        }
    },
    {
        'name': '10. Opportunities to strengthen ecological networks',
        'output_name': 'habitat_opportunities',
        'vector': {
            'Opportunities to strengthen ecological networks': 'Legend'
        },
        'ramp': {}
    },
    {
        'name': '11. Opportunities to strengthen ecological networks: priority places for action',
        'output_name': 'priority_habitat',
        'vector': {
            'Opportunities to strengthen ecological networks: priority places for action': 'Legend',
        },
        'ramp': {}
    },
    {
        'name': '12. Opportunities to deliver multiple ecosystem services: ecological connectivity and surface water regulation',
        'output_name': 'habitat_water_regulation',
        'vector': {
            'Opportunities to deliver multiple ecosystem services: ecological connectivity and surface water regulation': 'FinOp',
        },
        'ramp': {}
    },
    {
        'name': '13. Habitat map',
        'output_name': 'habitat_map',
        'vector': {
            'ExtractedFeatureOutputs': 'Context',
            'Peru_Viru_HabitatMap_20190524_Final': 'Class'

        },
        'ramp': {}
    }
]

# Get the currently open QGIS project
proj = QgsProject.instance()
# Get the root object of the TOC in this project
root = proj.layerTreeRoot()

# Get the root of the data groups that we want to scan from (may be `root` no nested groups)
dataRoot = root.findGroup("English")

zones = QgsVectorLayer(zoneFile, 'zones', 'ogr')
proj.addMapLayer(zones)

outputs = {}

# Start iterating through the individual map groups in the input data, creating an output as follows;
# {
#     'output_map_name': {
#         'vector': {
#             "grid_id": [
#                 "matching_attribute_1",
#                 "matching_attribute_2",
#                 "..."
#             ]
#         },
#         'ramp': {
#             'matched_ramp_name': [
#                 'grid_id': {
#                     'min': 'Number in range from 0 - 1',
#                     'max': 'Number in range from 0 - 1'
#                 },
#             ]
#         }
#     }
# }

for mapGroup in maps:
    if (mapGroup['name'] is None):
        print('##### Extracting Group - ROOT')
    else:
        print('##### Extracting Group - ' + mapGroup['name'])

    # Setup output structure
    outputs[mapGroup['output_name']] = {}
    outputs[mapGroup['output_name']]['vector'] = {}
    outputs[mapGroup['output_name']]['ramp'] = {}

    # Choose root TOC element to search in (i.e. layer group or just the provided root group)
    if (mapGroup['name'] != None):
        currentMapGroup = dataRoot.findGroup(mapGroup['name'])
    else:
        currentMapGroup = dataRoot

    # Iterate through children of the root data group looking for the expected name raster or vector maps
    for treeLayer in currentMapGroup.children():
        if (isinstance(treeLayer, QgsLayerTreeLayer)):
            layer = treeLayer.layer()
            if (layer.name() in mapGroup['vector'].keys()):
                print('Extracting vector layer ' + layer.name())
                extracted = getVectorFeaturesInLocation(
                    layer, zones, mapGroup['vector'][layer.name()], formatStr)
                fullMergeDict(
                    outputs[mapGroup['output_name']]['vector'], extracted)
            elif (layer.name() in mapGroup['ramp'].keys()):
                print('Extracting raster ramp layer ' + layer.name())
                if ('min' in mapGroup['ramp'][layer.name()] and 'max' in mapGroup['ramp'][layer.name()]):
                    extracted = getRasterStatsByLocation(layer, zones, mapGroup['ramp'][layer.name(
                    )]['min'], mapGroup['ramp'][layer.name()]['max'])
                else:
                    extracted = getRasterStatsByLocation(layer, zones)
                outputs[mapGroup['output_name']]['ramp'][mapGroup['ramp'][layer.name()]['name']] = extracted
            else:
                print('Skipping layer ' + layer.name())
        else:
            print('Skipping layer group ' + layer.name())


proj.removeMapLayer(zones)

with open(zoneFile, 'r') as gridData:
    grids = json.load(gridData)

    for feature in grids['features']:
        id = feature['properties']['id']
        legends = {}

        for map in outputs.keys():
            legends[map] = {}
            if len(outputs[map]['vector'].keys()) > 0:
                if (id in outputs[map]['vector']):
                    legends[map]['vector'] = outputs[map]['vector'][id]
            if len(outputs[map]['ramp'].keys()) > 0:
                legends[map]['ramp'] = {}
                for ramp in outputs[map]['ramp'].keys():
                    if (id in outputs[map]['ramp'][ramp]):
                        legends[map]['ramp'][ramp] = outputs[map]['ramp'][ramp][id]

            if 'vector' in legends[map] and len(legends[map]['vector']) == 0:
                del legends[map]['vector']
            if 'ramp' in legends[map] and len(legends[map]['ramp']) == 0:
                del legends[map]['ramp']
            if len(legends[map].keys()) == 0:
                del legends[map]

        feature['properties']['legends'] = legends

    with open(output, 'w') as out:
        json.dump(grids, out, ensure_ascii=False)
