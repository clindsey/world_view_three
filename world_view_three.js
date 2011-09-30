(function(){
  var SEED = 20110924;
  jQuery(document).ready(function(){
    var s = bind_to_elem('#canvas');
    MainScene(s);
  });
  var MainScene = function(s){
    var zone_manager = ZoneManager(SEED,50,50),
        tile_size = 18,
        tile_h_size = tile_size / 2,
        camera = new THREE.FirstPersonCamera({  'fov':60,
                                                'aspect':s.width/s.height,
                                                'near':1,
                                                'far':2000,
                                                'movementSpeed':100,
                                                'lookSpeed':0.125,
                                                'noFly':true,
                                                'lookVertical':true}),
        viewport = Viewport(s,60,60,tile_size,zone_manager,camera);
    camera.position.x = 0;
    camera.position.y = 100;
    camera.position.z = 0;
    viewport.render();
    var render_fn = function(){
      var vx = 0,
          vy = 0;
      if(camera.position.x > tile_h_size){
        camera.position.x = 0 - tile_h_size;
        vx += 1;
      }
      if(camera.position.x < 0 - tile_h_size){
        camera.position.x = tile_h_size;
        vx -= 1;
      }
      if(camera.position.z > tile_h_size){
        camera.position.z = 0 - tile_h_size;
        vy += 1;
      }
      if(camera.position.z < 0 - tile_h_size){
        camera.position.z = tile_h_size;
        vy -= 1;
      }
      if(vx !== 0 || vy !== 0){
        viewport.move_by(vx,vy);
        viewport.render();
      }
      s.renderer.render(s.scene,camera);
      requestAnimationFrame(render_fn);
    };
    render_fn();
    jQuery(document).keydown(function(e){
      if( e.keyCode === 88 || // Z
          e.keyCode === 90){ // X
        if(e.keyCode === 88){
          viewport.zoom_in();
        }
        if(e.keyCode === 90){
          viewport.zoom_out();
        }
        viewport.render();
      }
    });
  };
  var Viewport = function(s,width,height,tile_size,zone_manager,camera){
    var self = {},
        map = [],
        zoom_factor = 1,
        cursor_x = +localStorage['cursor_x'] || 0,
        cursor_y = +localStorage['cursor_y'] || 0,
        old_cursor_x,
        old_cursor_y,
        geometry = new THREE.CubeGeometry(tile_size,tile_size,tile_size);
    var ambient_light = new THREE.AmbientLight(0x8);
    s.scene.addLight(ambient_light);
    var directional_light = new THREE.DirectionalLight(0xDAE8F2);
    directional_light.position.x = 0.5;
    directional_light.position.y = 0.5;
    directional_light.position.z = 0.5;
    directional_light.position.normalize();
    s.scene.addLight(directional_light);
    self.move_by = function(vx,vy){
      cursor_x = clamp(cursor_x + vx,zone_manager.world_tile_width);
      cursor_y = clamp(cursor_y + vy,zone_manager.world_tile_height);
      localStorage['cursor_x'] = cursor_x;
      localStorage['cursor_y'] = cursor_y;
    };
    self.zoom_in = function(){
      var old_cursor_x = cursor_x;
      zone_manager.zoom_in(function(old_width,new_width,old_height,new_height,zf){
        zoom_factor = zf;
        cursor_x = ~~((cursor_x * new_width) / old_width);
        cursor_y = ~~((cursor_y * new_height) / old_height);
        localStorage['cursor_x'] = cursor_x;
        localStorage['cursor_y'] = cursor_y;
      });
    };
    self.zoom_out = function(){
      var old_cursor_x = cursor_x;
      zone_manager.zoom_out(function(old_width,new_width,old_height,new_height,zf){
        zoom_factor = zf;
        cursor_x = ~~((cursor_x * new_width) / old_width);
        cursor_y = ~~((cursor_y * new_height) / old_height);
        localStorage['cursor_x'] = cursor_x;
        localStorage['cursor_y'] = cursor_y;
      });
    };
    self.render = function(){
      if((old_cursor_x === cursor_x && old_cursor_y === cursor_y) && zone_manager.dirty === false){
        return;
      }
      var tile,
          start_x = Math.floor(width / 2),
          start_y = Math.floor(height / 2),
          factor,
          f,
          h;
      for(var y = 0, x; y < height; y += 1){
        if(map[y] === undefined){
          map[y] = [];
        }
        for(x = 0; x < width; x += 1){
          (function(x,y,start_x,start_y,cursor_x,cursor_y){
            zone_manager.get_tile(x + cursor_x - start_x,y + cursor_y - start_y,function(tile){
              var h = tile.height,
                  f = tile.color;
                  material = new THREE.MeshLambertMaterial({  'color':f,
                                                              'shading':THREE.FlatShading});
              if(map[y][x] === undefined){
                var cube = new THREE.Mesh(geometry,material);
                cube.overdraw = true;
                cube.position.y = h * (zoom_factor * 0.4);
                cube.position.x = x * tile_size - ((width / 2) * tile_size);
                cube.position.z = y * tile_size - ((height / 2) * tile_size);
                s.scene.addObject(cube);
                map[y][x] = cube;
              }else{
                map[y][x].position.y = h * (zoom_factor * 0.4);
                map[y][x].materials[0] = material;
              }
              if(x === start_x && y === start_y){
                camera.position.y = (h * (zoom_factor * 0.4)) + (tile_size * 2);
              }
            });
          })(x,y,start_x,start_y,cursor_x,cursor_y);
        }
      }
      old_cursor_x = cursor_x;
      old_cursor_y = cursor_y;
      zone_manager.dirty = false;
    };
    return self;
  };
  var ZoneManager = function(seed,w,h){
    var self = {},
        zones,
        world_tile_width,
        world_tile_height,
        zone_width,
        zone_height,
        zoom_factor = +localStorage['zoom_factor'] || 1,
        tile_cache;
    self.world_width = w;
    self.world_height = h;
    self.dirty = false;
    var init = function(zf){
      zone_width = (zf * 3) + 4;
      zone_height = (zf * 3) + 4;
      self.world_tile_width = zone_width * self.world_width;
      self.world_tile_height = zone_height * self.world_height;
      tile_cache = {};
      zones = {};
    };
    init(zoom_factor);
    self.zoom_in = function(callback){
      if(zoom_factor < 20){
        var a = self.world_tile_width,
            b = self.world_tile_height;
        zoom_factor += 5;
        localStorage['zoom_factor'] = zoom_factor;
        self.dirty = true;
        init(zoom_factor);
        callback(a,self.world_tile_width,b,self.world_tile_height,zoom_factor);
      }
    };
    self.zoom_out = function(callback){
      if(zoom_factor > 3){
        var a = self.world_tile_width,
            b = self.world_tile_height;
        zoom_factor -= 5;
        localStorage['zoom_factor'] = zoom_factor;
        self.dirty = true;
        init(zoom_factor);
        callback(a,self.world_tile_width,b,self.world_tile_height,zoom_factor);
      }
    };
    self.get_tile = function(x,y,callback){
      var clamped_x = clamp(x,self.world_tile_width),
          clamped_y = clamp(y,self.world_tile_height);
      if(tile_cache[clamped_x + ',' + clamped_y] !== undefined){
        callback(tile_cache[clamped_x + ',' + clamped_y]);
      }else{
        var zone_x = Math.floor(clamped_x / zone_width),
            zone_y = Math.floor(clamped_y / zone_height),
            local_x = clamped_x % zone_width,
            local_y = clamped_y % zone_height,
            zone;
        if(zones[zone_x + ',' + zone_y] === undefined){
          var z = Zone(seed,zone_x,zone_y,zone_width,zone_height,self.world_width,self.world_height,4 + (zoom_factor / 100) * 12);
          zones[zone_x + ',' + zone_y] = z;
        }
        zone = zones[zone_x + ',' + zone_y];
        if(zone.map[local_y] && zone.map[local_y][local_x]){
          tile_cache[x + ',' + y] = zone.map[local_y][local_x];
          callback(zone.map[local_y][local_x]);
        }
      }
    };
    return self;
  };
  var Zone = function(seed,x,y,zone_width,zone_height,world_width,world_height,height_step){
    var self = {},
        nw,
        ne,
        sw,
        se,
        ts_width = world_width;
    nw = ~~(Alea((y * ts_width + x) + seed)() * 255);
    if(x + 1 >= world_width){
      ne = ~~(Alea((y * ts_width + (0)) + seed)() * 255);
    }else{
      ne = ~~(Alea((y * ts_width + (x + 1)) + seed)() * 255);
    }
    if(y + 1 >= world_height){
      sw = ~~(Alea(((0) * ts_width + x) + seed)() * 255);
    }else{
      sw = ~~(Alea(((y + 1) * ts_width + x) + seed)() * 255);
    }
    if(y + 1 >= world_height){
      if(x + 1 >= world_width){
        se = ~~(Alea(((0) * ts_width + (0)) + seed)() * 255);
      }else{
        se = ~~(Alea(((0) * ts_width + (x + 1)) + seed)() * 255);
      }
    }else{
      if(x + 1 >= world_width){
        se = ~~(Alea(((y + 1) * ts_width + (0)) + seed)() * 255);
      }else{
        se = ~~(Alea(((y + 1) * ts_width + (x + 1)) + seed)() * 255);
      }
    }
    self.map = lerp(zone_width,zone_height,nw,ne,sw,se,height_step);
    return self;
  };
  var clamp = function(index,size){
    return (index + size) % size;
  };
  var tween = function(a,b,f){
    return a + f * (b - a);
  };
  var lerp = function(width,height,nw,ne,sw,se,height_step){
    var map = [],
        xf,
        yf,
        t,
        b,
        v,
        x_lookup = [];
    for(var y = 0, x; y < height; y += 1){
      map[y] = [];
      yf = y / height;
      for(x = 0; x < width; x += 1){
        if(x_lookup[x]){
          xf = x_lookup[x];
        }else{
          xf = x_lookup[x] = x / width;
        }
        t = nw + xf * (ne - nw);
        b = sw + xf * (se - sw);
        v = t + yf * (b - t);
        var factor = (~~v - 128) / 128,
            h,
            cr,
            cg,
            cb,
            p;
        if(factor <= -0.25){ // deep water
          cb = ~~tween(255,128,(Math.abs(factor) - 0.25) / 0.75);
          f = [0,0,cb,1];
          h = height_step;
        }else if(factor > -0.25 && factor <= 0){ // shallow water
          cg = ~~tween(128,0,(Math.abs(factor) / 0.25));
          f = [0,cg,255,1];
          h = height_step;
        }else if(factor > 0 && factor <= 0.0625){ // shore
          p = factor / 0.0625;
          cr = ~~tween(0,240,p);
          cg = ~~tween(128,240,p);
          cb = ~~tween(255,64,p);
          h = height_step;
          f = [cr,cg,cb,1];
        }else if(factor > 0.0625 && factor <= 0.15){ // sand
          p = (factor - 0.0625) / 0.0875;
          cr = ~~tween(240,32,p);
          cg = ~~tween(240,160,p);
          cb = ~~tween(64,0,p);
          f = [cr,cg,cb,1];
          h = height_step;
        }else if(factor > 0.15 && factor <= 0.6){ // grass
          p = (factor - 0.2) / 0.5;
          cr = ~~tween(32,32,p);
          cg = ~~tween(160,160,p);
          cb = 0;
          f = [cr,cg,cb,1];
          h = height_step * 2;
        }else if(factor > 0.6 && factor <= 0.7){ // grass
          p = (factor - 0.6) / 0.1;
          cr = ~~tween(32,224,p);
          cg = ~~tween(160,224,p);
          cb = 0;
          f = [cr,cg,cb,1];
          h = height_step * 2;
        }else if(factor > 0.7 && factor <= 0.8){ // dirt
          p = (factor - 0.7) / 0.1;
          cr = ~~tween(224,128,p);
          cb = ~~tween(0,128,p);
          f = [cr,cr,cb,1];
          h = height_step * 3;
        }else if(factor > 0.8 && factor <= 0.92){ // rock
          p = (factor - 0.8) / 0.12;
          cr = ~~tween(128,255,p);
          f = [cr,cr,cr,1];
          h = height_step * 4;
        }else{ // snow
          f = [255,255,255,1];
          h = height_step * 5;
        }
        h = ~~(factor * 20);
        if(h < height_step){
          h = height_step;
        }
        map[y][x] = {'height':h,'color':parse_color(f),'height_step':height_step};
      }
    }
    return map;
  };
  var bind_to_elem = function(elem_selector){
    var bind_elem = jQuery(elem_selector),
        width = bind_elem.width(),
        height = bind_elem.height(),
        scene = new THREE.Scene(),
        renderer = new THREE.WebGLRenderer();
    renderer.setSize(width,height);
    bind_elem.empty();
    bind_elem.append(renderer.domElement);
    return {  'bind_elem':bind_elem,
              'renderer':renderer,
              'scene':scene,
              'width':width,
              'height':height};
  };
  var parse_color = function(c){
    return (c[0] << 16 | c[1] << 8 | c[2]);
  };
})();
