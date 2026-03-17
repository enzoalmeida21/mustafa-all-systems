"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoType = exports.UserRole = void 0;
// User types
var UserRole;
(function (UserRole) {
    UserRole["PROMOTER"] = "PROMOTER";
    UserRole["SUPERVISOR"] = "SUPERVISOR";
    UserRole["INDUSTRY_OWNER"] = "INDUSTRY_OWNER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
// Photo types
var PhotoType;
(function (PhotoType) {
    PhotoType["FACADE_CHECKIN"] = "FACADE_CHECKIN";
    PhotoType["FACADE_CHECKOUT"] = "FACADE_CHECKOUT";
    PhotoType["OTHER"] = "OTHER";
})(PhotoType || (exports.PhotoType = PhotoType = {}));
