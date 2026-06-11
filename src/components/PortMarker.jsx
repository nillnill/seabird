import useStore from '../store/useStore.js';

const PORTS = [
  { id: 'busan',           name: '부산항',           lat: 35.1028, lng: 129.0403  },
  { id: 'incheon',         name: '인천항',           lat: 37.4563, lng: 126.6078  },
  { id: 'gwangyang',       name: '광양항',           lat: 34.9333, lng: 127.7167  },
  { id: 'singapore',       name: '싱가포르항',       lat: 1.2654,  lng: 103.8198  },
  { id: 'shanghai',        name: '상하이항',         lat: 31.2304, lng: 121.4737  },
  { id: 'rotterdam',       name: '로테르담항',       lat: 51.9225, lng: 4.4792    },
  { id: 'la_lb',           name: 'LA/LB항',         lat: 33.7701, lng: -118.1937 },
  { id: 'dubai',           name: '두바이항',         lat: 25.2048, lng: 55.2708   },
  { id: 'yokohama',        name: '요코하마항',       lat: 35.44,   lng: 139.64    },
  { id: 'kobe',            name: '고베항',           lat: 34.69,   lng: 135.19    },
  { id: 'ningbo',          name: '닝보·주산항',     lat: 29.87,   lng: 121.56    },
  { id: 'shenzhen',        name: '선전·옌톈항',     lat: 22.55,   lng: 114.28    },
  { id: 'hongkong',        name: '홍콩항',           lat: 22.31,   lng: 114.17    },
  { id: 'vladivostok',     name: '블라디보스토크항', lat: 43.12,   lng: 131.89    },
  { id: 'portklang',       name: '포트클랑',         lat: 2.99,    lng: 101.43    },
  { id: 'mumbai',          name: '뭄바이항',         lat: 18.93,   lng: 72.83     },
  { id: 'hamburg',         name: '함부르크항',       lat: 53.55,   lng: 9.98      },
  { id: 'newyork',         name: '뉴욕·뉴저지항',   lat: 40.66,   lng: -74.08    },
  { id: 'guangzhou',       name: '광저우·난사항',   lat: 22.77,   lng: 113.58    },
  { id: 'qingdao',         name: '칭다오항',         lat: 36.07,   lng: 120.38    },
  { id: 'tianjin',         name: '톈진·신강항',     lat: 38.99,   lng: 117.72    },
  { id: 'antwerp',         name: '앤트워프항',       lat: 51.23,   lng: 4.40      },
  { id: 'tanjung_pelepas', name: '탄중펠레파스항',   lat: 1.36,    lng: 103.55    },
  { id: 'xiamen',          name: '샤먼항',           lat: 24.48,   lng: 118.09    },
  { id: 'kaohsiung',       name: '가오슝항',         lat: 22.62,   lng: 120.27    },
  { id: 'laem_chabang',    name: '렘차방항',         lat: 13.09,   lng: 100.89    },
  { id: 'jakarta',         name: '자카르타항',       lat: -6.09,   lng: 106.87    },
  { id: 'colombo',         name: '콜롬보항',         lat: 6.94,    lng: 79.85     },
  { id: 'savannah',        name: '사바나항',         lat: 32.09,   lng: -81.09    },
  { id: 'hochiminhcity',   name: '호치민항',         lat: 10.76,   lng: 106.70    },
];

const GEOJSON = {
  type: 'FeatureCollection',
  features: PORTS.map((p, i) => ({
    type: 'Feature',
    id: i,
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: { portId: p.id, name: p.name, lat: p.lat, lng: p.lng },
  })),
};

export class PortMarkers {
  constructor(map) {
    this.map = map;
    this._hoveredId = null;
    this._onClick = this._onClick.bind(this);
    this._onMouseEnter = this._onMouseEnter.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._init();
  }

  _init() {
    this.map.addSource('ports', { type: 'geojson', data: GEOJSON });

    this.map.addLayer({
      id: 'ports-circle',
      type: 'circle',
      source: 'ports',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 8, 6],
        'circle-color': '#F59E0B',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255,255,255,0.6)',
      },
    });

    this.map.addLayer({
      id: 'ports-label',
      type: 'symbol',
      source: 'ports',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-anchor': 'bottom',
        'text-offset': [0, -0.5],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-optional': true,
      },
      paint: {
        'text-color': '#FDE68A',
        'text-halo-color': 'rgba(0,0,0,0.9)',
        'text-halo-width': 1.5,
        'text-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
      },
    });

    this.map.on('click', 'ports-circle', this._onClick);
    this.map.on('mouseenter', 'ports-circle', this._onMouseEnter);
    this.map.on('mouseleave', 'ports-circle', this._onMouseLeave);
  }

  _onClick(e) {
    if (!e.features?.length) return;
    const { portId, name, lat, lng } = e.features[0].properties;
    useStore.getState().setSelectedRegion({ id: portId, name, type: 'port', lat, lng });
  }

  _onMouseEnter(e) {
    this.map.getCanvas().style.cursor = 'pointer';
    if (!e.features?.length) return;
    if (this._hoveredId !== null) {
      this.map.setFeatureState({ source: 'ports', id: this._hoveredId }, { hover: false });
    }
    this._hoveredId = e.features[0].id;
    this.map.setFeatureState({ source: 'ports', id: this._hoveredId }, { hover: true });
  }

  _onMouseLeave() {
    this.map.getCanvas().style.cursor = '';
    if (this._hoveredId !== null) {
      this.map.setFeatureState({ source: 'ports', id: this._hoveredId }, { hover: false });
      this._hoveredId = null;
    }
  }

  destroy() {
    this.map.off('click', 'ports-circle', this._onClick);
    this.map.off('mouseenter', 'ports-circle', this._onMouseEnter);
    this.map.off('mouseleave', 'ports-circle', this._onMouseLeave);
    if (this.map.getLayer('ports-label')) this.map.removeLayer('ports-label');
    if (this.map.getLayer('ports-circle')) this.map.removeLayer('ports-circle');
    if (this.map.getSource('ports')) this.map.removeSource('ports');
  }
}
