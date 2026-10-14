// KNUCKLE v1: passive roll-stabilizing MagSafe wallet grip
// Target phone: iPhone 18 Pro Max (verify dimensions against Apple's spec page)
//
// Coordinate system
//   z = 0   : face that touches the phone's back. +z points away from the phone, toward your hand.
//   y       : up along the phone's long edge (portrait). x: across the phone.
//   origin  : center of the phone's MagSafe magnet ring.
//
// What it does
//   The phone and the card wallet form one body that spins freely on a thin bearing
//   around the axis that points out of the screen (roll). The cards hang below that axis,
//   so gravity keeps the phone level while your wrist twists. The knuckle (two-finger loop)
//   swings on a friction hinge: folded flat it is a wallet, swung out it is a grip.
//
// Bought parts
//   1x 6704ZZ bearing (20 x 27 x 4 mm)
//   1x MagSafe-compatible magnet ring, about 56 mm OD / 46 mm ID / 0.8 mm thick (glue it in)
//   1x M3 x 6 button-head screw (bearing cap)
//   1x M3 x 20 bolt + M3 nyloc nut (knuckle hinge; tighten to set friction)
//   1x 2 mm steel pin, about 10 mm long (roll lock; a cut paperclip works)
//   0-4x US quarters as trim weights (5.7 g each)
//
// Export one part at a time: set PART below, then F6 and Export STL.
// Or use the command line: openscad -D 'PART="plate"' -o plate.stl knuckle_v1.scad

PART = "assembly"; // [assembly, plate, carrier, cap, knuckle, print_all]

/* [Phone] */
phone_w = 78.0;    // width (mm)
phone_h = 163.4;   // height (mm)
phone_t = 8.75;    // thickness (mm)
magsafe_y = 0;     // MagSafe ring center measured from the phone's center (+ is toward the top)

/* [MagSafe magnet ring] */
ring_od = 56.4;
ring_id = 45.6;
ring_t  = 0.9;     // recess depth; the magnet sits flush with the phone face

/* [Bearing 6704ZZ] */
brg_id = 20;
brg_od = 27;
brg_w  = 4;
brg_inner_race_od = 22;   // standoff only touches the inner race
fit_shaft = 0.10;          // shaft undersize for a snug press fit
fit_bore  = 0.15;          // bore oversize

/* [Plate] */
plate_t = 2.4;
plate_w = phone_w - 4;
standoff = 0.5;

/* [Card pocket] */
cards = 3;
card_t = 0.84;              // per card, including embossing
card_h = 54.0;              // ISO ID-1 card short edge (the long edge points across the phone)
card_slack = 0.4;
pocket_wall = 1.2;
pocket_gap_from_axis = 19;  // keeps the pocket clear of the spinning carrier

/* [Trim weights] */
coin_d = 24.26 + 0.3;       // US quarter
coin_t = 1.75;
coin_x = 23.5;

/* [Carrier] */
carrier_d = 36;
carrier_back = 3.5;         // back wall, deep enough to hide the cap and screw head
lock_r = 15.8;              // roll-lock pin radius from the axis
lock_d = 2.2;

/* [Knuckle] */
finger_d = 23;              // finger hole diameter: measure your index and middle fingers at the middle joint
finger_wall = 3;
knuckle_t = 6;              // thickness of the knuckle plate
hinge_r = 3.0;
hinge_len = 15;             // barrel length between the lugs
lug_len = 6.5;
m3_clear = 3.3;
m3_tap = 2.5;

$fn = 96;
eps = 0.01;

// derived
pocket_gap = cards * card_t + card_slack;
pocket_top = -pocket_gap_from_axis;
pocket_bot = pocket_top - 2 * pocket_wall - card_h - 0.6;
z_plate_back = plate_t;
z_carrier_front = plate_t + standoff;
z_carrier_back = z_carrier_front + brg_w + carrier_back;
hinge_z = z_carrier_back + 0.4 + knuckle_t / 2;
finger_cx = hinge_r + 2 + finger_wall + finger_d / 2;
finger_cy = finger_d / 2 + finger_wall / 2;

module rounded_rect(w, h, r) {
    offset(r) offset(-r) square([w, h], center = true);
}

// ---------------- PLATE (phone side, spins with the phone) ----------------
module plate() {
    difference() {
        union() {
            // plate outline: disc around the MagSafe ring merged with the pocket area
            linear_extrude(plate_t)
                hull() {
                    circle(d = ring_od + 6);
                    translate([0, (pocket_top + pocket_bot) / 2 - 2])
                        rounded_rect(plate_w, pocket_top - pocket_bot + 4, 6);
                }
            // standoff that touches only the bearing's inner race
            translate([0, 0, plate_t - eps]) cylinder(d = brg_inner_race_od, h = standoff + eps);
            // shaft into the bearing's inner race
            translate([0, 0, z_carrier_front - eps]) cylinder(d = brg_id - fit_shaft, h = brg_w + eps);
            pocket();
        }
        // magnet ring recess, flush with the phone face
        translate([0, 0, -eps]) difference() {
            cylinder(d = ring_od + 0.3, h = ring_t + eps);
            translate([0, 0, -eps]) cylinder(d = ring_id - 0.3, h = ring_t + 3 * eps);
        }
        // screw hole for the bearing cap
        translate([0, 0, 1.2]) cylinder(d = m3_tap, h = 20);
        // roll-lock pin socket
        translate([-lock_r, 0, plate_t - 1.6]) cylinder(d = lock_d, h = 5);
    }
}

module pocket() {
    ph = pocket_top - pocket_bot;
    cy = (pocket_top + pocket_bot) / 2;
    zb = z_plate_back + pocket_gap;  // inside face of the back wall
    difference() {
        union() {
            // top and bottom rails (the sides stay open so cards slide in from either side)
            for (y = [pocket_top - pocket_wall / 2, pocket_bot + pocket_wall / 2])
                translate([-plate_w / 2, y - pocket_wall / 2, z_plate_back - eps])
                    cube([plate_w, pocket_wall, pocket_gap + eps]);
            // back wall
            translate([0, cy, zb]) linear_extrude(pocket_wall) rounded_rect(plate_w, ph, 3);
            // trim-weight bosses
            for (sx = [-1, 1])
                translate([sx * coin_x, cy, zb + pocket_wall - eps])
                    cylinder(d = coin_d + 2.4, h = coin_t + 0.25);
            // card-retention nubs on the inside of the back wall
            for (sx = [-1, 1])
                translate([sx * (plate_w / 2 - 6), cy, zb + eps])
                    rotate([90, 0, 0]) scale([1, 0.35, 1]) cylinder(d = 3, h = card_h * 0.6, center = true);
        }
        // thumb window so you can push the cards sideways
        translate([0, cy, zb - 1]) linear_extrude(pocket_wall + 5) rounded_rect(18, 34, 6);
        // coin recesses
        for (sx = [-1, 1])
            translate([sx * coin_x, cy, zb + pocket_wall + 0.25])
                cylinder(d = coin_d, h = coin_t + 1);
    }
}

// ---------------- CARRIER (holds the bearing's outer race, carries the hinge) ----------------
module carrier() {
    difference() {
        union() {
            translate([0, 0, z_carrier_front]) cylinder(d = carrier_d, h = brg_w + carrier_back);
            // hinge lugs
            for (s = [-1, 1])
                translate([0, s * (hinge_len / 2 + 0.3 + lug_len / 2), 0])
                    hull() {
                        translate([-4, -lug_len / 2, z_carrier_back - eps]) cube([8, lug_len, eps]);
                        translate([0, 0, hinge_z]) rotate([90, 0, 0]) cylinder(r = hinge_r + 0.6, h = lug_len, center = true);
                    }
        }
        // bearing seat, open toward the phone
        translate([0, 0, z_carrier_front - eps]) cylinder(d = brg_od + fit_bore, h = brg_w + eps);
        // access hole for the cap and screw
        translate([0, 0, z_carrier_front]) cylinder(d = brg_inner_race_od + 1.5, h = 50);
        // hinge bolt hole
        translate([0, 0, hinge_z]) rotate([90, 0, 0]) cylinder(d = m3_clear, h = 60, center = true);
        // roll-lock pin hole
        translate([-lock_r, 0, 0]) cylinder(d = lock_d, h = 50);
        // grip knurls around the rim, so it's easy to set the lock by hand
        for (a = [0 : 15 : 359])
            rotate(a) translate([carrier_d / 2 + 0.6, 0, z_carrier_front + 1]) cylinder(d = 2, h = brg_w + carrier_back);
    }
}

// ---------------- CAP (clamps the bearing's inner race onto the shaft) ----------------
module cap() {
    translate([0, 0, z_carrier_front + brg_w])
        difference() {
            cylinder(d = brg_inner_race_od, h = 1.5);
            translate([0, 0, -1]) cylinder(d = m3_clear, h = 5);
        }
}

// ---------------- KNUCKLE (two-finger loop on a friction hinge) ----------------
// Modeled folded flat. fold_angle = 90 swings it out into the grip position.
module knuckle_flat() {
    ro = finger_d / 2 + finger_wall;
    difference() {
        union() {
            // barrel
            rotate([90, 0, 0]) cylinder(r = hinge_r, h = hinge_len, center = true);
            // neck from the barrel to the finger loops
            translate([0, 0, -knuckle_t / 2]) linear_extrude(knuckle_t)
                hull() {
                    translate([0, -hinge_len / 2]) square([hinge_r, hinge_len]);
                    translate([finger_cx, 0]) square([2, hinge_len], center = true);
                }
            // finger loops
            translate([0, 0, -knuckle_t / 2]) linear_extrude(knuckle_t)
                hull() for (s = [-1, 1]) translate([finger_cx, s * finger_cy]) circle(r = ro);
        }
        // finger holes with softened edges
        for (s = [-1, 1]) translate([finger_cx, s * finger_cy, 0]) {
            cylinder(d = finger_d, h = knuckle_t + 2, center = true);
            for (m = [0, 1]) mirror([0, 0, m])
                translate([0, 0, knuckle_t / 2 - 1]) cylinder(d1 = finger_d, d2 = finger_d + 2.4, h = 1.2 + eps);
        }
        // hinge bolt hole
        rotate([90, 0, 0]) cylinder(d = m3_clear, h = 60, center = true);
        // keep the lugs clear wherever the loop body is wider than the barrel
        for (s = [-1, 1])
            translate([0, s * (hinge_len / 2 + 0.3 + lug_len / 2 + 2), 0])
                rotate([90, 0, 0]) cylinder(r = hinge_r + 2, h = lug_len + 4, center = true);
    }
}

module knuckle(fold_angle = 0) {
    translate([0, 0, hinge_z]) rotate([0, -fold_angle, 0]) knuckle_flat();
}

// ---------------- PREVIEW PHONE ----------------
module phone_ghost() {
    color("silver", 0.25)
        translate([0, -magsafe_y, -phone_t / 2])
            linear_extrude(phone_t, center = true) rounded_rect(phone_w, phone_h, 12);
}

// ---------------- OUTPUT ----------------
if (PART == "assembly") {
    phone_ghost();
    color("tan") plate();
    color("dimgray") carrier();
    color("orange") cap();
    color("goldenrod") knuckle(90);
}
else if (PART == "assembly_folded") {
    phone_ghost();
    color("tan") plate();
    color("dimgray") carrier();
    color("orange") cap();
    color("goldenrod") knuckle(0);
}
// Print orientations: each part sits on its largest flat face
else if (PART == "plate")   plate();
else if (PART == "carrier") translate([0, 0, -z_carrier_front]) carrier();
else if (PART == "cap")     translate([0, 0, -(z_carrier_front + brg_w)]) cap();
else if (PART == "knuckle") translate([0, 0, knuckle_t / 2]) knuckle_flat();
else if (PART == "print_all") {
    plate();
    translate([plate_w / 2 + carrier_d / 2 + 8, 30, -z_carrier_front]) carrier();
    translate([plate_w / 2 + carrier_d / 2 + 8, -5, -(z_carrier_front + brg_w)]) cap();
    translate([plate_w / 2 + 10, -50, knuckle_t / 2]) knuckle_flat();
}
