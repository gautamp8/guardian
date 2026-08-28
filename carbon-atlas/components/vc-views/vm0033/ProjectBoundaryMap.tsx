"use client"

import "leaflet/dist/leaflet.css"
import * as React from "react"
import { useEffect } from "react"
import {
  MapContainer,
  GeoJSON,
  useMap,
} from "react-leaflet"
import type { GeoJsonObject } from "geojson"
import * as L from "leaflet"
import { MapTileLayer } from "@/components/ui/map"

interface BoundsSetterProps {
  geojson: GeoJsonObject
}

function BoundsSetter({ geojson }: BoundsSetterProps) {
  const map = useMap()
  useEffect(() => {
    try {
      const layer = L.geoJSON(geojson)
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] })
      }
    } catch {
      // ignore invalid geometry
    }
  }, [map, geojson])
  return null
}

interface ProjectBoundaryMapProps {
  geojson: GeoJsonObject
}

export function ProjectBoundaryMap({ geojson }: ProjectBoundaryMapProps) {
  return (
    <MapContainer
      center={[12, -16]}
      zoom={8}
      style={{ height: "400px", width: "100%" }}
      className="rounded-lg"
      scrollWheelZoom={false}
    >
      {/* Shared basemap: OSM's own tile servers are a donated resource their
          usage policy does not cover a product like this. */}
      <MapTileLayer />
      <GeoJSON
        data={geojson}
        style={{
          color: "#16a34a",
          weight: 2,
          opacity: 0.9,
          fillColor: "#22c55e",
          fillOpacity: 0.25,
        }}
      />
      <BoundsSetter geojson={geojson} />
    </MapContainer>
  )
}
